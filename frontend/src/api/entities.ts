import { useQuery } from "@tanstack/react-query";
import { client, requireData } from "./client";
import type { components } from "./schema.gen";

export type EntityExport = components["schemas"]["EntityExport"];

export function useEntities() {
  return useQuery({
    queryKey: ["entities"],
    queryFn: async () => requireData(await client.GET("/api/entities")),
  });
}
