import type { EntityExport } from "../api/entities";
import type { SurfaceSource, TraceCandidate, TraceEvent } from "../api/trace";

export interface Protection {
  event: TraceEvent;
  guard: NonNullable<TraceCandidate["removed_by"]>;
}

function eventsOf({ trace, entityId }: { trace: readonly TraceEvent[]; entityId: string }) {
  return trace.filter((event) => event.after?.id === entityId);
}

export function mentionSource({
  trace,
  entityId,
  signalId,
  surface,
}: {
  trace: readonly TraceEvent[];
  entityId: string;
  signalId: string;
  surface: string;
}): SurfaceSource | null {
  for (const event of eventsOf({ trace, entityId })) {
    if (event.signal_id !== signalId) {
      continue;
    }
    const found = event.surfaces.find((item) => item.surface === surface);
    if (found !== undefined) {
      return found.source;
    }
  }
  return null;
}

export function latestOrgId({
  trace,
  entityId,
}: {
  trace: readonly TraceEvent[];
  entityId: string;
}): string | null {
  const events = eventsOf({ trace, entityId });
  return events.at(-1)?.after?.org_id ?? null;
}

export function createdInSignal({
  trace,
  entityId,
}: {
  trace: readonly TraceEvent[];
  entityId: string;
}): string | null {
  const created = trace.find(
    (event) => event.outcome === "created" && event.after?.id === entityId,
  );
  return created?.signal_id ?? null;
}

export function protections({
  trace,
  entityId,
}: {
  trace: readonly TraceEvent[];
  entityId: string;
}): Protection[] {
  return trace.flatMap((event) =>
    event.candidates.flatMap((candidate) =>
      candidate.id === entityId && candidate.removed_by !== null
        ? [{ event, guard: candidate.removed_by }]
        : [],
    ),
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery({ entity, query }: { entity: EntityExport; query: string }): boolean {
  const needle = normalize(query);
  if (needle === "") {
    return true;
  }
  return [entity.name, ...entity.aliases, ...entity.emails].some((value) =>
    normalize(value).includes(needle),
  );
}
