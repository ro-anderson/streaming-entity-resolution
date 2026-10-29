import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Signal } from "../api/signals";
import type { Entity, TraceEvent } from "../api/trace";
import { MATCH_THRESHOLD, formatScore } from "../logic/format";
import { UNNAMED_SPEAKER_REASON } from "../logic/review";

type Lookup = ReadonlyMap<string, Entity>;

function outcomePill(event: TraceEvent): string {
  if (event.outcome === "review") {
    return "revisão";
  }
  const verb = event.outcome === "created" ? "create" : "update";
  return `${verb} → ${event.entity_id ?? "?"}`;
}

function Step({ title, dot, children }: { title: string; dot: string; children?: ReactNode }) {
  return (
    <li className="timeline-item">
      <div className={`timeline-dot ${dot}`} />
      <div className="step-title">{title}</div>
      {children}
    </li>
  );
}

function orgName({ entity, lookup }: { entity: Entity | undefined; lookup: Lookup }) {
  if (entity?.org_id === null || entity?.org_id === undefined) {
    return null;
  }
  return lookup.get(entity.org_id)?.name ?? entity.org_id;
}

function ExactStep({ event, skipped }: { event: TraceEvent; skipped: boolean }) {
  if (skipped) {
    return (
      <Step title="1 · Match exato" dot="timeline-dot-idle">
        <div className="step-text">Não executado: o locutor não tem nome.</div>
      </Step>
    );
  }
  if (event.exact_match === "email") {
    return (
      <Step title="1 · Match exato" dot="">
        <div className="step-text">
          E-mail <span className="mono">{event.email}</span> já pertence a uma entidade.
        </div>
        <div className="mono step-result">resultado: match por email → {event.entity_id}</div>
      </Step>
    );
  }
  if (event.exact_match === "domain") {
    return (
      <Step title="1 · Match exato" dot="">
        <div className="step-text">O domínio da organização já está registrado.</div>
        <div className="mono step-result">resultado: match por domínio → {event.entity_id}</div>
      </Step>
    );
  }
  const text =
    event.email === null ? (
      <>Sem e-mail no sinal. Nenhuma chave determinística para comparar.</>
    ) : (
      <>
        E-mail <span className="mono">{event.email}</span> não pertence a nenhuma entidade.
      </>
    );
  return (
    <Step title="1 · Match exato" dot="timeline-dot-idle">
      <div className="step-text">{text}</div>
      <div className="mono step-result">resultado: pula</div>
    </Step>
  );
}

function SearchStep({
  event,
  skipped,
  lookup,
}: {
  event: TraceEvent;
  skipped: string | null;
  lookup: Lookup;
}) {
  const title = `2 · Busca léxica · índice ${event.kind.toLowerCase()} · top 5`;
  if (skipped !== null) {
    return (
      <Step title={title} dot="timeline-dot-idle">
        <div className="step-text">Não executada: {skipped}.</div>
      </Step>
    );
  }
  return (
    <Step title={title} dot="">
      <div className="mono step-text small">multi_match fuzzy + edge_ngram em name, aliases</div>
      {event.candidates.length === 0 ? (
        <div className="mono step-result">nenhum candidato</div>
      ) : (
        <div className="candidates">
          {event.candidates.map((candidate) => {
            const org = orgName({ entity: lookup.get(candidate.id), lookup });
            const removed = candidate.removed_by !== null;
            return (
              <div
                key={candidate.id}
                className={removed ? "candidate candidate-removed" : "candidate"}
              >
                <div>
                  <div className="candidate-name">{candidate.name}</div>
                  {removed ? (
                    <div className="candidate-guard">
                      {candidate.id} · removida pela guarda {candidate.removed_by}
                    </div>
                  ) : (
                    <div className="small muted">{candidate.id}</div>
                  )}
                </div>
                <div className="mono small muted candidate-org">
                  {org === null ? "" : `org: ${org}`}
                </div>
                <div className={removed ? "mono candidate-score muted" : "mono candidate-score"}>
                  {formatScore(candidate.score)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Step>
  );
}

function noLlmReason({ event, skipped }: { event: TraceEvent; skipped: string | null }): string {
  if (skipped !== null) {
    return skipped;
  }
  if (event.candidates.length === 0) {
    return "nenhum candidato para comparar";
  }
  return "todos os candidatos foram removidos pelas guardas";
}

function DecisionStep({ event, skipped }: { event: TraceEvent; skipped: string | null }) {
  const decision = event.decision;
  if (decision === null) {
    return (
      <Step title="3 · Decisão da LLM" dot="timeline-dot-idle">
        <div className="step-text">Sem LLM: {noLlmReason({ event, skipped })}.</div>
      </Step>
    );
  }
  const above = decision.confidence >= MATCH_THRESHOLD;
  return (
    <Step title="3 · Decisão da LLM" dot="">
      <div className="decision-grid">
        <div className="decision-box">
          <div className="mono decision-label">decision</div>
          <div className="decision-value">{decision.decision}</div>
        </div>
        <div className="decision-box">
          <div className="mono decision-label">candidate</div>
          <div className="decision-value">{decision.candidate_id ?? "—"}</div>
        </div>
        <div className="decision-box">
          <div className="mono decision-label">confidence</div>
          <div className="decision-value">
            {decision.confidence.toFixed(2)}{" "}
            <span className="mono small muted">
              {above ? "≥" : "<"} {MATCH_THRESHOLD.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      <p className="decision-reason">{decision.reason}</p>
    </Step>
  );
}

function DiffRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="diff-row">
      <span className="diff-key">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function added({ before, after }: { before: readonly string[]; after: readonly string[] }) {
  return after.filter((value) => !before.includes(value));
}

function newMentions({ before, after }: { before: Entity | null; after: Entity }) {
  const previous = new Set(
    (before?.mentions ?? []).map((mention) => `${mention.signal_id}|${mention.surface}`),
  );
  return after.mentions.filter(
    (mention) => !previous.has(`${mention.signal_id}|${mention.surface}`),
  );
}

function MentionList({ before, after }: { before: Entity | null; after: Entity }) {
  const mentions = newMentions({ before, after });
  if (mentions.length === 0) {
    return null;
  }
  return (
    <DiffRow label="mention">
      <span className="mono small">
        {mentions.map((mention) => `{${mention.signal_id}, “${mention.surface}”}`).join(" ")}
      </span>
    </DiffRow>
  );
}

function UpdateDiff({ before, after, lookup }: { before: Entity; after: Entity; lookup: Lookup }) {
  const aliases = added({ before: before.aliases, after: after.aliases });
  const emails = added({ before: before.emails, after: after.emails });
  return (
    <div className="diff">
      {before.name !== after.name && (
        <DiffRow label="name">
          <span className="strike">{before.name}</span> → <strong>{after.name}</strong>
        </DiffRow>
      )}
      {aliases.length > 0 && <DiffRow label="aliases">+ {aliases.join(", ")}</DiffRow>}
      {emails.length > 0 && <DiffRow label="emails">+ {emails.join(", ")}</DiffRow>}
      {before.org_id !== after.org_id && (
        <DiffRow label="org">
          {orgName({ entity: before, lookup }) ?? "—"} →{" "}
          <strong>{orgName({ entity: after, lookup }) ?? "—"}</strong>
        </DiffRow>
      )}
      {before.description !== after.description && (
        <DiffRow label="description">{after.description}</DiffRow>
      )}
      <MentionList before={before} after={after} />
    </div>
  );
}

function CreatedEntity({ after, lookup }: { after: Entity; lookup: Lookup }) {
  const org = orgName({ entity: after, lookup });
  return (
    <div className="diff">
      <DiffRow label="id">
        <Link to={`/entities/${after.id}`} className="mono small">
          {after.id}
        </Link>
      </DiffRow>
      <DiffRow label="name">
        <strong>{after.name}</strong>
      </DiffRow>
      {after.aliases.length > 0 && <DiffRow label="aliases">{after.aliases.join(", ")}</DiffRow>}
      {after.emails.length > 0 && <DiffRow label="emails">{after.emails.join(", ")}</DiffRow>}
      {org !== null && <DiffRow label="org">{org}</DiffRow>}
      {after.description !== "" && <DiffRow label="description">{after.description}</DiffRow>}
      <MentionList before={null} after={after} />
    </div>
  );
}

function OutcomeStep({ event, lookup }: { event: TraceEvent; lookup: Lookup }) {
  if (event.outcome === "review") {
    return (
      <Step title="4 · Enviado para revisão" dot="timeline-dot-review">
        <div className="step-text">{event.reason}</div>
        <div className="mono step-result">nada foi criado nem atualizado</div>
      </Step>
    );
  }
  if (event.after === null) {
    return null;
  }
  if (event.outcome === "created" || event.before === null) {
    return (
      <Step title="4 · Entidade criada" dot="timeline-dot-created">
        <CreatedEntity after={event.after} lookup={lookup} />
      </Step>
    );
  }
  return (
    <Step title="4 · Update aplicado" dot="timeline-dot-updated">
      <UpdateDiff before={event.before} after={event.after} lookup={lookup} />
    </Step>
  );
}

export function TracePanel({
  signal,
  events,
  selected,
  onSelect,
  lookup,
}: {
  signal: Signal;
  events: readonly TraceEvent[];
  selected: number | null;
  onSelect: (eventIndex: number) => void;
  lookup: Lookup;
}) {
  const event = selected === null ? undefined : events[selected];
  if (event === undefined) {
    return (
      <section className="card column column-trace" aria-label="Trace da decisão">
        <span className="mono small muted">trace · {signal.id}</span>
        <p className="step-text">Nenhuma entidade observada neste sinal.</p>
      </section>
    );
  }
  const unnamed = event.reason === UNNAMED_SPEAKER_REASON;
  const searchSkipped = unnamed
    ? "o locutor não tem nome"
    : event.exact_match !== null
      ? "o match exato resolveu"
      : null;
  return (
    <section className="card column column-trace" aria-label="Trace da decisão">
      <div className="trace-head">
        <div className="trace-head-text">
          <span className="mono small muted">
            trace · {signal.id} · {event.kind}
          </span>
          <h2 className="trace-title">“{event.name}”</h2>
        </div>
        <span className={`pill pill-lg pill-${event.outcome}`}>{outcomePill(event)}</span>
      </div>
      {events.length > 1 && (
        <div className="event-tabs" role="group" aria-label="Observações do sinal">
          {events.map((item, index) => (
            <button
              key={index}
              type="button"
              className={index === selected ? "event-tab active" : "event-tab"}
              aria-pressed={index === selected}
              onClick={() => {
                onSelect(index);
              }}
            >
              <span className={`dot dot-${item.outcome}`} />
              {item.name}
            </button>
          ))}
        </div>
      )}
      <ol className="timeline">
        <ExactStep event={event} skipped={unnamed} />
        <SearchStep event={event} skipped={searchSkipped} lookup={lookup} />
        <DecisionStep event={event} skipped={searchSkipped} />
        <OutcomeStep event={event} lookup={lookup} />
      </ol>
    </section>
  );
}
