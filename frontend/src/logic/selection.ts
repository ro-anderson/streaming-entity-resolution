import type { TraceEvent } from "../api/trace";

function priority(event: TraceEvent): number {
  if (event.outcome === "review") {
    return 0;
  }
  if (event.candidates.some((candidate) => candidate.removed_by !== null)) {
    return 1;
  }
  if (event.outcome === "created") {
    return 2;
  }
  return 3;
}

export function defaultEventIndex(events: readonly TraceEvent[]): number | null {
  let best: number | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;
  events.forEach((event, index) => {
    const current = priority(event);
    if (current < bestPriority) {
      best = index;
      bestPriority = current;
    }
  });
  return best;
}
