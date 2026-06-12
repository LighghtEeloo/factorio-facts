export type ViewMode = "detailed" | "concise";

export interface RecipeLayoutEntry {
  id: string;
  recipeId: string;
}

export type LayoutReorderPlacement = "before" | "after";

export type GraphSide = "top" | "right" | "bottom" | "left";

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphEdgePorts {
  sourceSide: GraphSide;
  targetSide: GraphSide;
}

export interface RecipeLayout {
  id: string;
  name: string;
  entries: RecipeLayoutEntry[];
  graphPositions: Record<string, GraphNodePosition>;
  edgePorts: Record<string, GraphEdgePorts>;
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
