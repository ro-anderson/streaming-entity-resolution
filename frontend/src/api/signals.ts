import { useQuery } from "@tanstack/react-query";
import { client, requireData } from "./client";
import type { components } from "./schema.gen";

export type Signal = components["schemas"]["Signal"];
export type Contact = components["schemas"]["Contact"];
export type Utterance = components["schemas"]["Utterance"];

export function useSignals() {
  return useQuery({
    queryKey: ["signals"],
    queryFn: async () => requireData(await client.GET("/api/signals")),
  });
}
