import { entity, traceEvent } from "./fixtures";
import { entityChanges, reconstructRepository, seededEntities } from "./repository";

const tenantBefore = entity({ id: "e_001", name: "Caravela", kind: "ORGANIZATION" });
const tenantAfter = entity({
  id: "e_001",
  name: "Caravela",
  kind: "ORGANIZATION",
  mentions: [{ signal_id: "s_002", surface: "Caravela" }],
});
const pedroCreated = entity({
  id: "e_002",
  name: "Pedro",
  mentions: [{ signal_id: "s_001", surface: "Pedro" }],
});
const pedroUpdated = entity({
  id: "e_002",
  name: "Pedro Nogueira",
  aliases: ["Pedro"],
  mentions: [
    { signal_id: "s_001", surface: "Pedro" },
    { signal_id: "s_002", surface: "Pedro Nogueira" },
  ],
});

const trace = [
  traceEvent({ signal_id: "s_001", outcome: "created", entity_id: "e_002", after: pedroCreated }),
  traceEvent({ signal_id: "s_002", outcome: "review", reason: "locutor sem nome" }),
  traceEvent({
    signal_id: "s_002",
    outcome: "updated",
    entity_id: "e_001",
    before: tenantBefore,
    after: tenantAfter,
  }),
  traceEvent({
    signal_id: "s_002",
    outcome: "updated",
    entity_id: "e_002",
    before: pedroCreated,
    after: pedroUpdated,
  }),
];
const signalIds = ["s_001", "s_002", "s_003"];

function namesAt(upTo: number): Record<string, string> {
  return Object.fromEntries(
    reconstructRepository({ trace, signalIds, upTo }).map((entry) => [
      entry.entity.id,
      entry.entity.name,
    ]),
  );
}

describe("seededEntities", () => {
  it("takes entities that never have a created event from their first before", () => {
    expect(seededEntities(trace)).toEqual([tenantBefore]);
  });
});

describe("reconstructRepository", () => {
  it("contains seeded entities before any signal", () => {
    expect(namesAt(-1)).toEqual({ e_001: "Caravela" });
  });

  it("applies events up to and including the selected signal", () => {
    expect(namesAt(0)).toEqual({ e_001: "Caravela", e_002: "Pedro" });
    expect(namesAt(1)).toEqual({ e_001: "Caravela", e_002: "Pedro Nogueira" });
  });

  it("records the last signal that touched each entity", () => {
    const entries = reconstructRepository({ trace, signalIds, upTo: 2 });
    expect(entries.map((entry) => [entry.entity.id, entry.lastSignalIndex])).toEqual([
      ["e_001", 1],
      ["e_002", 1],
    ]);
    expect(entries.find((entry) => entry.entity.id === "e_001")?.entity).toBe(tenantAfter);
  });
});

describe("entityChanges", () => {
  it("tells created, updated and mention-only changes apart", () => {
    const created = entityChanges(trace.slice(0, 1));
    expect(created.get("e_002")).toEqual({ kind: "created" });
    const changes = entityChanges(trace.slice(1));
    expect(changes.get("e_002")).toEqual({ kind: "updated" });
    expect(changes.get("e_001")).toEqual({ kind: "mentioned", count: 1 });
  });
});
