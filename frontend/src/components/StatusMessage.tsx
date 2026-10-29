export function StatusMessage({ error }: { error: boolean }) {
  if (error) {
    return (
      <p className="status status-error">
        Não foi possível carregar a última execução. Confira se a API está rodando (make api).
      </p>
    );
  }
  return <p className="status">Carregando…</p>;
}
