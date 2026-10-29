import { Link, useSearchParams } from "react-router-dom";
import { useEntities } from "../api/entities";
import { Layout } from "../components/Layout";
import { SearchBox } from "../components/SearchBox";
import { StatusMessage } from "../components/StatusMessage";
import { matchesQuery } from "../logic/entityView";

export function EntitiesPage() {
  const entities = useEntities();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  if (entities.data === undefined) {
    return (
      <Layout actions={<SearchBox />}>
        <StatusMessage error={entities.isError} />
      </Layout>
    );
  }
  const visible = entities.data.filter((entity) => matchesQuery({ entity, query }));
  return (
    <Layout actions={<SearchBox />}>
      <main className="main main-column">
        <div className="page-intro">
          <h1>Entidades</h1>
          <p>
            {query === ""
              ? `${String(entities.data.length)} no repositório ao fim da execução.`
              : `${String(visible.length)} de ${String(entities.data.length)} para “${query}”.`}
          </p>
        </div>
        <div className="entity-grid">
          {visible.map((entity) => {
            const details = [...entity.aliases.map((alias) => `aka ${alias}`), ...entity.emails];
            return (
              <Link key={entity.id} to={`/entities/${entity.id}`} className="card repo-card">
                <div className="repo-card-head">
                  <span className="repo-card-name">{entity.name}</span>
                  <span className="mono small muted">{entity.id}</span>
                </div>
                <div className="repo-card-sub">
                  {[entity.kind, ...details.slice(0, 2)].join(" · ")}
                </div>
                <div className="repo-card-sub mono small">
                  {entity.mentions.length} {entity.mentions.length === 1 ? "menção" : "menções"}
                </div>
              </Link>
            );
          })}
        </div>
        {visible.length === 0 && <p className="status">Nenhuma entidade encontrada.</p>}
      </main>
    </Layout>
  );
}
