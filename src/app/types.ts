export type LocationFilter = "all" | string;
export type CategoryFilter = "all" | string;
export type ViewMode = "detailed" | "concise";

export interface FilterState {
  location: LocationFilter;
  category: CategoryFilter;
  includeMining: boolean;
  includeRecycling: boolean;
  includeTechnology: boolean;
  includeLocked: boolean;
}
