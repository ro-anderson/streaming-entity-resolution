import type { Entity, TraceEvent } from "../api/trace";

export interface RepositoryEntry {
  entity: Entity;
  lastSignalIndex: number;
}

export type EntityChange =
  { kind: "created" } | { kind: "updated" } | { kind: "mentioned"; count: number };

function createdIds(trace: readonly TraceEvent[]): Set<string> {
  return new Set(
    trace.flatMap((event) =>
      event.outcome === "created" && event.after !== null ? [event.after.id] : [],
    ),
  );
}

export function seededEntities(trace: readonly TraceEvent[]): Entity[] {
  const created = createdIds(trace);
  const seeded = new Map<string, Entity>();
  for (const event of trace) {
    const before = event.before;
    if (before !== null && !created.has(before.id) && !seeded.has(before.id)) {
      seeded.set(before.id, before);
    }
  }
  return [...seeded.values()];
}

export function reconstructRepository({
  trace,
  signalIds,
  upTo,
}: {
  trace: readonly TraceEvent[];
  signalIds: readonly string[];
  upTo: number;
}): RepositoryEntry[] {
  const positions = new Map(signalIds.map((id, index) => [id, index]));
  const state = new Map<string, RepositoryEntry>(
    seededEntities(trace).map((entity) => [entity.id, { entity, lastSignalIndex: -1 }]),
  );
  for (const event of trace) {
    const position = positions.get(event.signal_id);
    if (position === undefined || position > upTo || event.after === null) {
      continue;
    }
    state.set(event.after.id, { entity: event.after, lastSignalIndex: position });
  }
  return [...state.values()];
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function changedIdentity({ before, after }: { before: Entity; after: Entity }): boolean {
  return (
    before.name !== after.name ||
    before.description !== after.description ||
    before.org_id !== after.org_id ||
    !sameList(before.aliases, after.aliases) ||
    !sameList(before.emails, after.emails)
  );
}

export function entityChanges(events: readonly TraceEvent[]): Map<string, EntityChange> {
  const firstBefore = new Map<string, Entity | null>();
  const lastAfter = new Map<string, Entity>();
  for (const event of events) {
    if (event.after === null) {
      continue;
    }
    const id = event.after.id;
    if (!firstBefore.has(id)) {
      firstBefore.set(id, event.outcome === "created" ? null : event.before);
    }
    lastAfter.set(id, event.after);
  }
  const changes = new Map<string, EntityChange>();
  for (const [id, after] of lastAfter) {
    const before = firstBefore.get(id) ?? null;
    if (before === null) {
      changes.set(id, { kind: "created" });
    } else if (changedIdentity({ before, after })) {
      changes.set(id, { kind: "updated" });
    } else {
      changes.set(id, {
        kind: "mentioned",
        count: Math.max(after.mentions.length - before.mentions.length, 0),
      });
    }
  }
  return changes;
}

export function eventsBySignal(trace: readonly TraceEvent[]): Map<string, TraceEvent[]> {
  const grouped = new Map<string, TraceEvent[]>();
  for (const event of trace) {
    const list = grouped.get(event.signal_id);
    if (list === undefined) {
      grouped.set(event.signal_id, [event]);
    } else {
      list.push(event);
    }
  }
  return grouped;
}

export function tenantName(trace: readonly TraceEvent[]): string | null {
  const organization = seededEntities(trace).find((entity) => entity.kind === "ORGANIZATION");
  return organization?.name ?? null;
}
