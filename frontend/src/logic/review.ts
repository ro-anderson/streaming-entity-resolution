import type { TraceEvent } from "../api/trace";
import { MATCH_THRESHOLD } from "./format";

export const UNNAMED_SPEAKER_REASON = "locutor sem nome";
export const NO_ANCHOR_REASON = "primeiro nome sem ancora";

export type ReviewCategory =
  "unnamed-speaker" | "no-anchor" | "ambiguous" | "low-confidence" | "other";

export interface ReviewLabel {
  category: ReviewCategory;
  pill: string;
  urgent: boolean;
}

export function reviewCategory(event: TraceEvent): ReviewCategory {
  if (event.reason === UNNAMED_SPEAKER_REASON) {
    return "unnamed-speaker";
  }
  if (event.reason === NO_ANCHOR_REASON) {
    return "no-anchor";
  }
  if (event.decision?.decision === "ambiguous") {
    return "ambiguous";
  }
  if (event.decision?.decision === "match" && event.decision.confidence < MATCH_THRESHOLD) {
    return "low-confidence";
  }
  return "other";
}

export function reviewLabel(event: TraceEvent): ReviewLabel {
  const category = reviewCategory(event);
  switch (category) {
    case "unnamed-speaker":
      return { category, pill: "locutor sem nome", urgent: false };
    case "no-anchor":
      return { category, pill: "sem âncora", urgent: false };
    case "ambiguous":
      return { category, pill: "ambíguo", urgent: true };
    case "low-confidence":
      return {
        category,
        pill: `confiança ${(event.decision?.confidence ?? 0).toFixed(2)}`,
        urgent: true,
      };
    case "other":
      return { category, pill: event.reason ?? "revisão", urgent: true };
  }
}
