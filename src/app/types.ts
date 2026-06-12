export type ViewMode = "detailed" | "concise";

export interface FilterState {
  locations: string[];
  categories: string[];
  includeMining: boolean;
  includeRecycling: boolean;
  includeTechnology: boolean;
  includeLocked: boolean;
}
