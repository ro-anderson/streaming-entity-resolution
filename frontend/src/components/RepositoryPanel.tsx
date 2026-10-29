import { useState } from "react";
import { Link } from "react-router-dom";
import type { Entity, EntityKind } from "../api/trace";
import type { EntityChange, RepositoryEntry } from "../logic/repository";

type Filter = "all" | EntityKind;

const FILTERS: [Filter, string][] = [
  ["all", "Tudo"],
  ["PERSON", "Pessoas"],
  ["ORGANIZATION", "Organizações"],
];

const CHANGE_ORDER: Record<EntityChange["kind"], number> = {
  created: 0,
  updated: 1,
  mentioned: 2,
};

function changeRank(change: EntityChange | undefined): number {
  return change === undefined ? 3 : CHANGE_ORDER[change.kind];
}

function ChangePill({ change, id }: { change: EntityChange | undefined; id: string }) {
  if (change === undefined) {
    return <span className="mono small muted">{id}</span>;
  }
  if (change.kind === "created") {
    return <span className="pill pill-created">criada</span>;
  }
  if (change.kind === "updated") {
    return <span className="pill pill-updated">atualizada</span>;
  }
  return (
    <span className="pill pill-neutral">
      +{change.count} {change.count === 1 ? "menção" : "menções"}
    </span>
  );
}

function subtitle({
  entity,
  lookup,
}: {
  entity: Entity;
  lookup: ReadonlyMap<string, Entity>;
}): string {
  const parts: string[] = [entity.kind];
  if (entity.org_id !== null && entity.org_id !== undefined) {
    parts.push(lookup.get(entity.org_id)?.name ?? entity.org_id);
  }
  if (entity.aliases.length > 0) {
    parts.push(`aka ${entity.aliases.slice(0, 2).join(", ")}`);
  } else if (entity.emails[0] !== undefined) {
    parts.push(entity.emails[0]);
  }
  return parts.join(" · ");
}

export function RepositoryPanel({
  signalId,
  entries,
  changes,
  lookup,
  pendingReviews,
}: {
  signalId: string;
  entries: readonly RepositoryEntry[];
  changes: ReadonlyMap<string, EntityChange>;
  lookup: ReadonlyMap<string, Entity>;
  pendingReviews: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = entries
    .filter((entry) => filter === "all" || entry.entity.kind === filter)
    .sort(
      (left, right) =>
        changeRank(changes.get(left.entity.id)) - changeRank(changes.get(right.entity.id)) ||
        right.lastSignalIndex - left.lastSignalIndex ||
        left.entity.id.localeCompare(right.entity.id),
    );
  return (
    <section className="column column-repo" aria-label="Repositório">
      <div className="column-title">
        <h2>Repositório</h2>
        <span className="mono small muted">estado após {signalId}</span>
      </div>
      <div className="segmented" role="group" aria-label="Filtrar por tipo">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={value === filter ? "segmented-button active" : "segmented-button"}
            aria-pressed={value === filter}
            onClick={() => {
              setFilter(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.map(({ entity }) => {
        const change = changes.get(entity.id);
        return (
          <Link
            key={entity.id}
            to={`/entities/${entity.id}`}
            className={
              change === undefined ? "card repo-card" : `card repo-card repo-card-${change.kind}`
            }
          >
            <div className="repo-card-head">
              <span className="repo-card-name">{entity.name}</span>
              <ChangePill change={change} id={entity.id} />
            </div>
            <div className="repo-card-sub">{subtitle({ entity, lookup })}</div>
          </Link>
        );
      })}
      {visible.length === 0 && <p className="step-text">Nenhuma entidade ainda.</p>}
      {pendingReviews > 0 && (
        <Link to="/review" className="review-banner">
          <span>
            {pendingReviews} {pendingReviews === 1 ? "menção aguardando" : "menções aguardando"}{" "}
            revisão
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}
