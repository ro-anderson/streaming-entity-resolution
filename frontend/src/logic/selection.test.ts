import { traceEvent } from "./fixtures";
import { defaultEventIndex } from "./selection";

const updated = traceEvent({ signal_id: "s_001", outcome: "updated" });
const created = traceEvent({ signal_id: "s_001", outcome: "created" });
const review = traceEvent({ signal_id: "s_001", outcome: "review" });
const guarded = traceEvent({
  signal_id: "s_001",
  outcome: "updated",
  candidates: [{ id: "e_002", name: "Outro", score: 3, removed_by: "org_id" }],
});

describe("defaultEventIndex", () => {
  it("returns null when the signal has no events", () => {
    expect(defaultEventIndex([])).toBeNull();
  });

  it("prefers review over everything", () => {
    expect(defaultEventIndex([updated, created, guarded, review])).toBe(3);
  });

  it("prefers a guard removal over created and updated", () => {
    expect(defaultEventIndex([updated, created, guarded])).toBe(2);
  });

  it("prefers created over updated", () => {
    expect(defaultEventIndex([updated, created])).toBe(1);
  });

  it("keeps the first event among equals", () => {
    expect(defaultEventIndex([updated, created, created, review, review])).toBe(3);
  });
});
