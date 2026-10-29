import type { Signal } from "../api/signals";
import type { SurfaceSource } from "../api/trace";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const MATCH_THRESHOLD = 0.85;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatDay(iso)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function signalPlace(signal: Signal): string {
  if (signal.source === "meeting") {
    return "meeting";
  }
  return signal.channel ?? "slack";
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}

const SOURCE_LABELS: Record<SurfaceSource, string> = {
  author: "autor",
  participant: "participante",
  speaker: "locutor",
  text: "texto",
};

export function sourceLabel(source: SurfaceSource): string {
  return SOURCE_LABELS[source];
}

export function signalSummary(signal: Signal): string {
  if (signal.source === "meeting") {
    return signal.title ?? "meeting";
  }
  return signal.text ?? "";
}

export function replayHref(signalId: string): string {
  return `/replay?s=${encodeURIComponent(signalId)}`;
}
