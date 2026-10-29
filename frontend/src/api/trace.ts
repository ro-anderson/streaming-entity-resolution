import { useQuery } from "@tanstack/react-query";
import { client, requireData } from "./client";
import type { components } from "./schema.gen";

export type TraceEvent = components["schemas"]["TraceEvent"];
export type TraceCandidate = components["schemas"]["TraceCandidate"];
export type TraceSurface = components["schemas"]["TraceSurface"];
export type SurfaceSource = TraceSurface["source"];
export type Outcome = TraceEvent["outcome"];
export type Entity = components["schemas"]["Entity"];
export type EntityKind = Entity["kind"];

export function useTrace() {
  return useQuery({
    queryKey: ["trace"],
    queryFn: async () => requireData(await client.GET("/api/trace")),
  });
}
