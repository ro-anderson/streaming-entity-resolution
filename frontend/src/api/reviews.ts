import { useQuery } from "@tanstack/react-query";
import { client, requireData } from "./client";
import type { components } from "./schema.gen";

export type ReviewItem = components["schemas"]["ReviewItem"];

export function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: async () => requireData(await client.GET("/api/reviews")),
  });
}
