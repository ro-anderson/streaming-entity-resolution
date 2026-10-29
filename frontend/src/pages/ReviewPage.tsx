import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EntityExport } from "../api/entities";
import { useEntities } from "../api/entities";
import type { Signal } from "../api/signals";
import { useSignals } from "../api/signals";
import type { TraceEvent } from "../api/trace";
import { useTrace } from "../api/trace";
import { Layout } from "../components/Layout";
import { SignalBody } from "../components/SignalBody";
import { StatusMessage } from "../components/StatusMessage";
import {
  MATCH_THRESHOLD,
  formatDateTime,
  formatScore,
  replayHref,
  signalPlace,
} from "../logic/format";
import { eventsBySignal } from "../logic/repository";
import { reviewCategory, reviewLabel } from "../logic/review";

interface ReviewEntry {
  event: TraceEvent;
  signal: Signal | undefined;
  signalEvents: TraceEvent[];
  eventIndex: number;
}

function surfaceOf(event: TraceEvent): string {
  return event.surfaces[0]?.surface ?? event.name;
}

function activeCandidates(event: TraceEvent) {
  return event.candidates.filter((candidate) => candidate.removed_by === null);
}

function queueSubtitle({ event, signal }: { event: TraceEvent; signal: Signal | undefined }) {
  switch (reviewCategory(event)) {
    case "unnamed-speaker":
      return `${signal?.title ?? "meeting"} · ${String(signal?.participants.length ?? 0)} participantes no convite`;
    case "no-anchor":
      return "Só o primeiro nome, sem e-mail, organização ou cargo";
    case "ambiguous": {
      const count = activeCandidates(event).length;
      return `${String(count)} ${count === 1 ? "candidato" : "candidatos"}, nenhum escolhido com segurança`;
    }
    case "low-confidence":
      return `Abaixo do threshold de ${MATCH_THRESHOLD.toFixed(2)}`;
    case "other":
      return event.reason ?? "";
  }
}

function question(event: TraceEvent): string {
  const surface = surfaceOf(event);
  if (reviewCategory(event) === "unnamed-speaker") {
    return `Quem é “${surface}”?`;
  }
  if (event.kind === "ORGANIZATION") {
    return `Qual organização é “${surface}”?`;
  }
  return `A quem “${surface}” se refere?`;
}

function whyText({
  event,
  names,
}: {
  event: TraceEvent;
  names: ReadonlyMap<string, EntityExport>;
}): string {
  const decision = event.decision;
  const surface = surfaceOf(event);
  switch (reviewCategory(event)) {
    case "unnamed-speaker":
      return `A transcrição identificou este locutor só como “${surface}”. Sem um nome não há o que comparar com o repositório, então nada foi criado nem atualizado.`;
    case "no-anchor":
      return `“${surface}” é só um primeiro nome, sem e-mail, organização ou cargo que ancore a identidade. Criar uma entidade nova arriscaria um duplicado.`;
    case "ambiguous":
      return `A LLM não escolheu nenhum candidato (confiança ${(decision?.confidence ?? 0).toFixed(2)}). O pipeline não chuta: a menção espera uma pessoa do time.`;
    case "low-confidence": {
      const candidateId = decision?.candidate_id ?? null;
      const candidate = candidateId === null ? undefined : names.get(candidateId);
      return `A LLM sugeriu ${candidate?.name ?? candidateId ?? "um candidato"} com confiança ${(decision?.confidence ?? 0).toFixed(2)}, abaixo do threshold de ${MATCH_THRESHOLD.toFixed(2)}. Nada foi mesclado.`;
    }
    case "other":
      return event.reason ?? "";
  }
}

function CandidateOptions({
  event,
  names,
}: {
  event: TraceEvent;
  names: ReadonlyMap<string, EntityExport>;
}) {
  if (event.candidates.length === 0) {
    return null;
  }
  return (
    <div className="section">
      <h3>Candidatos que a busca trouxe</h3>
      {event.candidates.map((candidate) => {
        const entity = names.get(candidate.id);
        const removed = candidate.removed_by !== null;
        const details = [entity?.description, entity?.emails[0]].filter(
          (value): value is string => value !== undefined && value !== "",
        );
        return (
          <div key={candidate.id} className={removed ? "option option-removed" : "option"}>
            <span className="option-body">
              <span className="option-name">{candidate.name}</span>
              {removed && (
                <span className="candidate-guard">removida pela guarda {candidate.removed_by}</span>
              )}
              {details.length > 0 && <span className="option-sub">{details.join(" · ")}</span>}
            </span>
            <span className="mono small muted">
              {candidate.id} · {formatScore(candidate.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewDetail({
  entry,
  names,
}: {
  entry: ReviewEntry;
  names: ReadonlyMap<string, EntityExport>;
}) {
  const { event, signal } = entry;
  const meta = [
    event.signal_id,
    signal?.source,
    signal?.source === "slack" ? signal.channel : null,
    signal === undefined ? null : formatDateTime(signal.occurred_at),
  ].filter((value): value is string => value !== null && value !== undefined && value !== "");
  return (
    <section className="card column column-detail" aria-label="Detalhe da menção">
      <div className="trace-head">
        <div className="trace-head-text">
          <span className="mono small muted">{meta.join(" · ")}</span>
          <h2 className="detail-title">{question(event)}</h2>
        </div>
        <span className="pill pill-lg pill-review">
          {event.decision === null ? "sem LLM" : `LLM: ${event.decision.decision}`}
        </span>
      </div>
      {signal !== undefined && (
        <blockquote className="excerpt">
          <SignalBody
            signal={signal}
            events={entry.signalEvents}
            utteranceEvents={[event]}
            selected={entry.eventIndex}
          />
        </blockquote>
      )}
      <div className="section">
        <h3>Por que foi para revisão</h3>
        <p className="section-text">{whyText({ event, names })}</p>
      </div>
      <CandidateOptions event={event} names={names} />
      {event.decision !== null && (
        <div className="section">
          <h3>Razão da LLM</h3>
          <p className="section-text">{event.decision.reason}</p>
        </div>
      )}
      <Link to={replayHref(event.signal_id)} className="small">
        Ver no replay
      </Link>
    </section>
  );
}

function ReviewQueue({
  signals,
  trace,
  entities,
}: {
  signals: Signal[];
  trace: TraceEvent[];
  entities: EntityExport[];
}) {
  const [selected, setSelected] = useState(0);
  const entries = useMemo(() => {
    const bySignal = new Map(signals.map((signal) => [signal.id, signal]));
    const grouped = eventsBySignal(trace);
    return trace.flatMap((event): ReviewEntry[] => {
      if (event.outcome !== "review") {
        return [];
      }
      const signalEvents = grouped.get(event.signal_id) ?? [event];
      return [
        {
          event,
          signal: bySignal.get(event.signal_id),
          signalEvents,
          eventIndex: signalEvents.indexOf(event),
        },
      ];
    });
  }, [signals, trace]);
  const names = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const current = entries[selected];
  return (
    <main className="main">
      <section className="column column-queue" aria-label="Fila">
        <div className="page-intro">
          <h1>Menções sem dono</h1>
          <p>
            O pipeline não chutou. {entries.length}{" "}
            {entries.length === 1 ? "menção ficou" : "menções ficaram"} para uma pessoa do time
            decidir.
          </p>
        </div>
        {entries.map((entry, index) => {
          const label = reviewLabel(entry.event);
          return (
            <button
              key={index}
              type="button"
              className={index === selected ? "card queue-item active" : "card queue-item"}
              aria-pressed={index === selected}
              onClick={() => {
                setSelected(index);
              }}
            >
              <span className="queue-item-head">
                <span className="mono small muted">
                  {entry.event.signal_id}
                  {entry.signal === undefined ? "" : ` · ${signalPlace(entry.signal)}`}
                </span>
                <span className={label.urgent ? "pill pill-review" : "pill pill-neutral"}>
                  {label.pill}
                </span>
              </span>
              <span className="queue-item-name">“{surfaceOf(entry.event)}”</span>
              <span className="queue-item-sub">
                {queueSubtitle({ event: entry.event, signal: entry.signal })}
              </span>
            </button>
          );
        })}
      </section>
      {current === undefined ? (
        <section className="card column column-detail">
          <p className="section-text">Nenhuma menção aguardando revisão.</p>
        </section>
      ) : (
        <ReviewDetail entry={current} names={names} />
      )}
    </main>
  );
}

export function ReviewPage() {
  const signals = useSignals();
  const trace = useTrace();
  const entities = useEntities();
  if (signals.data === undefined || trace.data === undefined || entities.data === undefined) {
    return (
      <Layout>
        <StatusMessage error={signals.isError || trace.isError || entities.isError} />
      </Layout>
    );
  }
  return (
    <Layout>
      <ReviewQueue signals={signals.data} trace={trace.data} entities={entities.data} />
    </Layout>
  );
}
