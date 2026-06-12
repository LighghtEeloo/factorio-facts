export type ViewMode = "detailed" | "concise";

export interface RecipeLayoutEntry {
  id: string;
  recipeId: string;
}

export type LayoutReorderPlacement = "before" | "after";

export type GraphSide = "top" | "right" | "bottom" | "left";

export type GraphTerminalKind = "input" | "output";

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphEdgePorts {
  sourceSide: GraphSide;
  targetSide: GraphSide;
}

export interface GraphEdgeRoute {
  x: number;
  y: number;
}

export interface GraphTerminalSides {
  inputSide: GraphSide;
  outputSide: GraphSide;
}

export interface RecipeLayout {
  id: string;
  name: string;
  entries: RecipeLayoutEntry[];
  graphPositions: Record<string, GraphNodePosition>;
  edgePorts: Record<string, GraphEdgePorts>;
  edgeRoutes: Record<string, GraphEdgeRoute>;
  terminalSides: Record<string, GraphSide>;
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
