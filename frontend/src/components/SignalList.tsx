import { Link } from "react-router-dom";
import type { Signal } from "../api/signals";
import type { Outcome, TraceEvent } from "../api/trace";
import { formatDateTime, formatDay, replayHref, signalPlace, signalSummary } from "../logic/format";
import { SignalBody } from "./SignalBody";

const PAST_VISIBLE = 3;
const OUTCOME_LABELS: [Outcome, string][] = [
  ["updated", "casou"],
  ["created", "criou"],
  ["review", "revisão"],
];

function OutcomePills({ events }: { events: readonly TraceEvent[] }) {
  if (events.length === 0) {
    return <div className="mono small muted">nenhuma entidade no sinal</div>;
  }
  return (
    <div className="pills">
      {OUTCOME_LABELS.map(([outcome, label]) => {
        const count = events.filter((event) => event.outcome === outcome).length;
        return count === 0 ? null : (
          <span key={outcome} className={`pill pill-${outcome}`}>
            {count} {label}
          </span>
        );
      })}
    </div>
  );
}

export function SignalList({
  signals,
  index,
  eventsOf,
  selected,
  onSelect,
}: {
  signals: readonly Signal[];
  index: number;
  eventsOf: (signalId: string) => TraceEvent[];
  selected: number | null;
  onSelect: (eventIndex: number) => void;
}) {
  const current = signals[index];
  const next = signals[index + 1];
  const pastStart = Math.max(index - PAST_VISIBLE, 0);
  const past = signals.slice(pastStart, index);
  return (
    <section className="column column-signals" aria-label="Sinais">
      <div className="column-title">
        <h2>Sinais</h2>
        <span className="mono small muted">em ordem, um por vez</span>
      </div>
      {past.map((signal) => (
        <Link
          key={signal.id}
          to={replayHref(signal.id)}
          className="card signal-card signal-card-past"
        >
          <div className="mono signal-meta">
            <span>
              {signal.id} · {signalPlace(signal)}
            </span>
            <span>{formatDay(signal.occurred_at)}</span>
          </div>
          <SignalBody signal={signal} events={eventsOf(signal.id)} selected={null} compact />
        </Link>
      ))}
      {current !== undefined && (
        <article className="card signal-card signal-card-current">
          <div className="mono signal-meta">
            <span>
              {current.id} · {signalPlace(current)}
            </span>
            <span>{formatDateTime(current.occurred_at)}</span>
          </div>
          <SignalBody
            signal={current}
            events={eventsOf(current.id)}
            selected={selected}
            onSelect={onSelect}
          />
          <OutcomePills events={eventsOf(current.id)} />
        </article>
      )}
      {next !== undefined && (
        <Link to={replayHref(next.id)} className="card signal-card signal-card-next">
          <div className="mono signal-meta">
            <span>
              {next.id} · {signalPlace(next)}
            </span>
            <span>na fila</span>
          </div>
          <span className="next-preview">{signalSummary(next)}</span>
        </Link>
      )}
      <div className="legend">
        <span>
          <span className="hl hl-updated">nome</span> casou
        </span>
        <span>
          <span className="hl hl-created">nome</span> criou
        </span>
        <span>
          <span className="hl hl-review">nome</span> revisão
        </span>
      </div>
    </section>
  );
}
