import type { EntityExport } from "../api/entities";
import { matchesQuery } from "./entityView";

export type KindFilter = "all" | EntityExport["kind"];

export const KIND_FILTERS: readonly KindFilter[] = ["all", "PERSON", "ORGANIZATION"];

export function isKindFilter(value: string | null): value is KindFilter {
  return KIND_FILTERS.some((filter) => filter === value);
}

export function listEntities<T extends EntityExport>({
  entities,
  kind,
  query,
}: {
  entities: readonly T[];
  kind: KindFilter;
  query: string;
}): T[] {
  return entities
    .filter((entity) => kind === "all" || entity.kind === kind)
    .filter((entity) => matchesQuery({ entity, query }))
    .sort(
      (left, right) =>
        right.mentions.length - left.mentions.length || left.name.localeCompare(right.name),
    );
}

export function kindCounts(entities: readonly EntityExport[]): Record<KindFilter, number> {
  return {
    all: entities.length,
    PERSON: entities.filter((entity) => entity.kind === "PERSON").length,
    ORGANIZATION: entities.filter((entity) => entity.kind === "ORGANIZATION").length,
  };
}
