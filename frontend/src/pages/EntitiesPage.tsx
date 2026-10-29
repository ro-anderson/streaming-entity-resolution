import { Link, useSearchParams } from "react-router-dom";
import { type EntityExport, useEntities } from "../api/entities";
import { useTrace } from "../api/trace";
import { Layout } from "../components/Layout";
import { SearchBox } from "../components/SearchBox";
import { StatusMessage } from "../components/StatusMessage";
import {
  KIND_FILTERS,
  type KindFilter,
  isKindFilter,
  kindCounts,
  listEntities,
} from "../logic/entityList";
import { latestOrgId } from "../logic/entityView";

const FILTER_LABELS: Record<KindFilter, string> = {
  all: "Todas",
  PERSON: "Pessoas",
  ORGANIZATION: "Organizações",
};

const KIND_LABELS: Record<EntityExport["kind"], string> = {
  PERSON: "Pessoa",
  ORGANIZATION: "Organização",
};

function plural({ count, one, many }: { count: number; one: string; many: string }): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function EntityCard({
  entity,
  organization,
}: {
  entity: EntityExport;
  organization: string | null;
}) {
  const identity = [organization, entity.emails[0]].filter(
    (part) => part !== null && part !== undefined,
  );
  return (
    <Link to={`/entities/${entity.id}`} className="card entity-card">
      <div className="entity-card-head">
        <span className="entity-card-name">{entity.name}</span>
        <span className={`pill pill-kind kind-${entity.kind.toLowerCase()}`}>
          {KIND_LABELS[entity.kind]}
        </span>
      </div>
      {identity.length > 0 && <div className="entity-card-identity">{identity.join(" · ")}</div>}
      {entity.description !== "" && <p className="entity-card-description">{entity.description}</p>}
      <div className="entity-card-foot mono">
        <span>{plural({ count: entity.mentions.length, one: "menção", many: "menções" })}</span>
        {entity.aliases.length > 0 && (
          <span>{plural({ count: entity.aliases.length, one: "alias", many: "aliases" })}</span>
        )}
        <span className="entity-card-id">{entity.id}</span>
      </div>
    </Link>
  );
}

export function EntitiesPage() {
  const entities = useEntities();
  const trace = useTrace();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const rawKind = searchParams.get("kind");
  const kind: KindFilter = isKindFilter(rawKind) ? rawKind : "all";
  if (entities.data === undefined) {
    return (
      <Layout actions={<SearchBox />}>
        <StatusMessage error={entities.isError} />
      </Layout>
    );
  }
  const names = new Map(entities.data.map((entity) => [entity.id, entity.name]));
  const counts = kindCounts(entities.data);
  const visible = listEntities({ entities: entities.data, kind, query });
  function organizationOf(entity: EntityExport): string | null {
    if (entity.kind !== "PERSON" || trace.data === undefined) {
      return null;
    }
    const orgId = latestOrgId({ trace: trace.data, entityId: entity.id });
    return orgId === null ? null : (names.get(orgId) ?? null);
  }
  function selectKind(value: KindFilter) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete("kind");
    } else {
      next.set("kind", value);
    }
    setSearchParams(next);
  }
  return (
    <Layout actions={<SearchBox />}>
      <main className="main main-column">
        <div className="page-intro">
          <h1>Entidades</h1>
          <p>
            Pessoas e organizações no repositório ao fim da execução, das mais mencionadas para as
            menos. Use a busca para filtrar por nome, apelido ou e-mail.
          </p>
        </div>
        <div className="entity-toolbar">
          <div className="segmented" role="group" aria-label="Filtrar por tipo">
            {KIND_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                className={value === kind ? "segmented-button active" : "segmented-button"}
                aria-pressed={value === kind}
                onClick={() => {
                  selectKind(value);
                }}
              >
                {FILTER_LABELS[value]} <span className="segmented-count">{counts[value]}</span>
              </button>
            ))}
          </div>
          <span className="mono small muted">
            {query === ""
              ? plural({ count: visible.length, one: "entidade", many: "entidades" })
              : `${String(visible.length)} para “${query}”`}
          </span>
        </div>
        <div className="entity-grid">
          {visible.map((entity) => (
            <EntityCard key={entity.id} entity={entity} organization={organizationOf(entity)} />
          ))}
        </div>
        {visible.length === 0 && <p className="status">Nenhuma entidade encontrada.</p>}
      </main>
    </Layout>
  );
}
