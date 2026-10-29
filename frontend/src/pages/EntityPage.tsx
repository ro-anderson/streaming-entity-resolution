import { Link, useParams } from "react-router-dom";
import type { EntityExport } from "../api/entities";
import { useEntities } from "../api/entities";
import type { Signal } from "../api/signals";
import { useSignals } from "../api/signals";
import type { TraceEvent } from "../api/trace";
import { useTrace } from "../api/trace";
import { Layout } from "../components/Layout";
import { SearchBox } from "../components/SearchBox";
import { StatusMessage } from "../components/StatusMessage";
import type { Protection } from "../logic/entityView";
import { createdInSignal, latestOrgId, mentionSource, protections } from "../logic/entityView";
import { formatDay, replayHref, sourceLabel } from "../logic/format";

const GUARD_EXPLANATIONS: Record<Protection["guard"], string> = {
  email: "e-mails diferentes",
  org_id: "organizações diferentes",
};

function downloadJson(entity: EntityExport) {
  const blob = new Blob([`${JSON.stringify(entity, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${entity.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Identity({
  entity,
  organization,
}: {
  entity: EntityExport;
  organization: EntityExport | null;
}) {
  return (
    <section className="card panel" aria-label="Identidade">
      <h2>Identidade</h2>
      <div className="field">
        <span className="field-label">emails</span>
        {entity.emails.length === 0 ? (
          <span className="field-value muted">—</span>
        ) : (
          entity.emails.map((email) => (
            <span key={email} className="mono field-value">
              {email}
            </span>
          ))
        )}
      </div>
      <div className="field">
        <span className="field-label">aliases</span>
        {entity.aliases.length === 0 ? (
          <span className="field-value muted">—</span>
        ) : (
          <div className="pills">
            {entity.aliases.map((alias) => (
              <span key={alias} className="pill pill-alias">
                {alias}
              </span>
            ))}
          </div>
        )}
      </div>
      {entity.kind === "PERSON" && (
        <div className="field">
          <span className="field-label">organização</span>
          {organization === null ? (
            <span className="field-value muted">—</span>
          ) : (
            <Link to={`/entities/${organization.id}`} className="field-value">
              <strong>{organization.name}</strong>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function ProtectedHomonym({
  items,
  names,
}: {
  items: readonly Protection[];
  names: ReadonlyMap<string, EntityExport>;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="guard-card" aria-label="Homônimo protegido">
      <h2>Homônimo protegido</h2>
      {items.map(({ event, guard }, index) => {
        const resolved = event.entity_id === null ? undefined : names.get(event.entity_id);
        return (
          <p key={index}>
            Em <Link to={replayHref(event.signal_id)}>{event.signal_id}</Link>,{" "}
            <strong>“{event.name}”</strong> não foi mesclado com esta entidade: a guarda{" "}
            <span className="mono">{guard}</span> ({GUARD_EXPLANATIONS[guard]}) a removeu dos
            candidatos.
            {resolved !== undefined && (
              <>
                {" "}
                Ficou com <Link to={`/entities/${resolved.id}`}>{resolved.name}</Link>.
              </>
            )}
          </p>
        );
      })}
    </section>
  );
}

function Revisions({
  entity,
  createdAt,
  signalsById,
}: {
  entity: EntityExport;
  createdAt: string | null;
  signalsById: ReadonlyMap<string, Signal>;
}) {
  const lastIndex = entity.revisions.length - 1;
  return (
    <section className="card panel panel-revisions" aria-label="Revisions">
      <div className="column-title">
        <h2>Como a visão mudou</h2>
        <span className="mono small muted">revisions</span>
      </div>
      {entity.revisions.length === 0 ? (
        <p className="step-text">Sem revisões registradas.</p>
      ) : (
        <ol className="timeline">
          {entity.revisions.map((revision, index) => {
            const isCurrent = index === lastIndex;
            const isCreation = revision.signal_id === createdAt && index === 0;
            const labels = [
              revision.signal_id,
              isCreation ? "criação" : null,
              isCurrent ? "atual" : null,
            ].filter((value): value is string => value !== null);
            const dot = isCurrent
              ? "timeline-dot-updated"
              : isCreation
                ? "timeline-dot-ring-created"
                : "";
            const tone = isCurrent ? "tag-current" : isCreation ? "tag-created" : "tag-default";
            const signal = signalsById.get(revision.signal_id);
            return (
              <li key={`${revision.signal_id}-${String(index)}`} className="timeline-item">
                <div className={`timeline-dot ${dot}`} />
                <div className="revision-meta mono">
                  <span className={tone}>{labels.join(" · ")}</span>
                  {signal !== undefined && (
                    <span className="muted">{formatDay(signal.occurred_at)}</span>
                  )}
                </div>
                {revision.name !== entity.name && (
                  <div className="small muted">{revision.name}</div>
                )}
                <div className={isCurrent ? "revision-text revision-current" : "revision-text"}>
                  {revision.description}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Mentions({ entity, trace }: { entity: EntityExport; trace: readonly TraceEvent[] }) {
  const lastMention = entity.mentions.at(-1);
  return (
    <section className="card panel panel-mentions" aria-label="Menções">
      <div className="column-title">
        <h2>Onde aparece</h2>
        <span className="mono small muted">mentions</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">sinal</th>
              <th scope="col">surface</th>
              <th scope="col">onde</th>
            </tr>
          </thead>
          <tbody>
            {entity.mentions.map((mention, index) => {
              const source = mentionSource({
                trace,
                entityId: entity.id,
                signalId: mention.signal_id,
                surface: mention.surface,
              });
              return (
                <tr key={`${mention.signal_id}-${mention.surface}-${String(index)}`}>
                  <td className="mono">
                    <Link to={replayHref(mention.signal_id)}>{mention.signal_id}</Link>
                  </td>
                  <td>{mention.surface}</td>
                  <td className="muted">{sourceLabel(source ?? "text")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lastMention !== undefined && (
        <Link to={replayHref(lastMention.signal_id)} className="small">
          Ver no replay
        </Link>
      )}
    </section>
  );
}

function EntityDetail({
  entity,
  entities,
  trace,
  signals,
}: {
  entity: EntityExport;
  entities: EntityExport[];
  trace: TraceEvent[];
  signals: Signal[];
}) {
  const names = new Map(entities.map((item) => [item.id, item]));
  const signalsById = new Map(signals.map((signal) => [signal.id, signal]));
  const orgId = latestOrgId({ trace, entityId: entity.id });
  const organization = orgId === null ? null : (names.get(orgId) ?? null);
  return (
    <main className="main main-column">
      <div className="entity-head">
        <div className="entity-head-text">
          <div className="pills">
            <span className="pill pill-kind">{entity.kind}</span>
            <span className="mono small muted">{entity.id}</span>
          </div>
          <h1 className="entity-name">{entity.name}</h1>
          {entity.description !== "" && <p className="entity-description">{entity.description}</p>}
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            downloadJson(entity);
          }}
        >
          Exportar JSON
        </button>
      </div>
      <div className="row">
        <div className="stack">
          <Identity entity={entity} organization={organization} />
          <ProtectedHomonym items={protections({ trace, entityId: entity.id })} names={names} />
        </div>
        <Revisions
          entity={entity}
          createdAt={createdInSignal({ trace, entityId: entity.id })}
          signalsById={signalsById}
        />
        <Mentions entity={entity} trace={trace} />
      </div>
    </main>
  );
}

export function EntityPage() {
  const { id } = useParams();
  const entities = useEntities();
  const trace = useTrace();
  const signals = useSignals();
  if (entities.data === undefined || trace.data === undefined || signals.data === undefined) {
    return (
      <Layout actions={<SearchBox />}>
        <StatusMessage error={entities.isError || trace.isError || signals.isError} />
      </Layout>
    );
  }
  const entity = entities.data.find((item) => item.id === id);
  return (
    <Layout actions={<SearchBox />}>
      {entity === undefined ? (
        <p className="status">
          Entidade {id} não existe na última execução. <Link to="/entities">Ver todas</Link>
        </p>
      ) : (
        <EntityDetail
          entity={entity}
          entities={entities.data}
          trace={trace.data}
          signals={signals.data}
        />
      )}
    </Layout>
  );
}
