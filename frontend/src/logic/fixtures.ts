import type { Signal } from "../api/signals";
import type { Mark } from "./highlight";
import type { Entity, TraceEvent } from "../api/trace";

export function entity(overrides: Partial<Entity> & Pick<Entity, "id" | "name">): Entity {
  return {
    kind: "PERSON",
    aliases: [],
    emails: [],
    description: "",
    mentions: [],
    revisions: [],
    domains: [],
    org_id: null,
    ...overrides,
  };
}

export function traceEvent(
  overrides: Partial<TraceEvent> & Pick<TraceEvent, "signal_id">,
): TraceEvent {
  return {
    kind: "PERSON",
    name: "Pessoa",
    surfaces: [],
    email: null,
    org_id: null,
    exact_match: null,
    candidates: [],
    decision: null,
    outcome: "updated",
    reason: null,
    entity_id: null,
    before: null,
    after: null,
    ...overrides,
  };
}

export function signal(overrides: Partial<Signal> & Pick<Signal, "id">): Signal {
  return {
    source: "slack",
    occurred_at: "2026-09-01T13:02:00Z",
    participants: [],
    utterances: [],
    ...overrides,
  };
}

export function fixtureMarks(items: readonly { surface: string; eventIndex: number }[]): Mark[] {
  return items.map((item) => ({ ...item, outcome: "updated" }));
}
