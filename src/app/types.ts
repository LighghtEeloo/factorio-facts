export type ViewMode = "detailed" | "concise";

export interface RecipeLayoutEntry {
  id: string;
  recipeId: string;
}

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface RecipeLayout {
  id: string;
  name: string;
  entries: RecipeLayoutEntry[];
  graphPositions: Record<string, GraphNodePosition>;
  collapsed: boolean;
}

export interface FilterState {
  locations: string[];
  categories: string[];
  includeMining: boolean;
  includeRecycling: boolean;
  includeTechnology: boolean;
  includeLocked: boolean;
}
