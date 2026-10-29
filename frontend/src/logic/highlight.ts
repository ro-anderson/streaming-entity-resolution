import type { Signal, Utterance } from "../api/signals";
import type { Outcome, SurfaceSource, TraceEvent } from "../api/trace";

export interface Mark {
  surface: string;
  outcome: Outcome;
  eventIndex: number;
}

export interface Segment {
  text: string;
  mark: Mark | null;
}

interface Range {
  start: number;
  end: number;
  mark: Mark;
}

export function marksFor({
  events,
  source,
}: {
  events: readonly TraceEvent[];
  source: SurfaceSource;
}): Mark[] {
  return events.flatMap((event, eventIndex) =>
    event.surfaces
      .filter((surface) => surface.source === source && surface.surface !== "")
      .map((surface) => ({ surface: surface.surface, outcome: event.outcome, eventIndex })),
  );
}

function overlaps({
  ranges,
  start,
  end,
}: {
  ranges: readonly Range[];
  start: number;
  end: number;
}) {
  return ranges.some((range) => start < range.end && range.start < end);
}

export function segmentText({ text, marks }: { text: string; marks: readonly Mark[] }): Segment[] {
  const ordered = [...marks].sort((left, right) => right.surface.length - left.surface.length);
  const ranges: Range[] = [];
  for (const mark of ordered) {
    let from = text.indexOf(mark.surface);
    while (from !== -1) {
      const end = from + mark.surface.length;
      if (!overlaps({ ranges, start: from, end })) {
        ranges.push({ start: from, end, mark });
      }
      from = text.indexOf(mark.surface, from + 1);
    }
  }
  ranges.sort((left, right) => left.start - right.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), mark: null });
    }
    segments.push({ text: text.slice(range.start, range.end), mark: range.mark });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), mark: null });
  }
  return segments;
}

export function markForName({
  name,
  marks,
}: {
  name: string;
  marks: readonly Mark[];
}): Mark | null {
  return marks.find((mark) => mark.surface === name) ?? null;
}

export function relevantUtterances({
  signal,
  events,
}: {
  signal: Signal;
  events: readonly TraceEvent[];
}): Utterance[] {
  const textSurfaces = marksFor({ events, source: "text" }).map((mark) => mark.surface);
  const speakers = new Set(marksFor({ events, source: "speaker" }).map((mark) => mark.surface));
  const seenSpeakers = new Set<string>();
  return signal.utterances.filter((utterance) => {
    if (textSurfaces.some((surface) => utterance.text.includes(surface))) {
      seenSpeakers.add(utterance.speaker);
      return true;
    }
    if (speakers.has(utterance.speaker) && !seenSpeakers.has(utterance.speaker)) {
      seenSpeakers.add(utterance.speaker);
      return true;
    }
    return false;
  });
}
