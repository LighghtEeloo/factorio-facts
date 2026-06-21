import type {
  IngredientPrototype,
  ProductPrototype,
} from "../factorio/prototypes";

export type AppView = "recipes" | "layouts" | "graph";

export const defaultProductionSize = 1;

export interface LayoutModuleSettings {
  count: number;
  id: string;
}

export interface LayoutBeaconSettings {
  count: number;
  id: string;
  modules: LayoutModuleSettings[];
}

export interface RecipeLayoutEntry {
  beacons?: LayoutBeaconSettings[];
  id: string;
  machineId?: string;
  modules?: LayoutModuleSettings[];
  productionSize: number;
  recipeId: string;
}

export interface GraphRelay {
  id: string;
  itemKeys: string[];
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
  relays: GraphRelay[];
  graphPositions: Record<string, GraphNodePosition>;
  edgePorts: Record<string, GraphEdgePorts>;
  edgeRoutes: Record<string, GraphEdgeRoute>;
  edgeItems: Record<string, string[]>;
  externalItems: Record<string, string[]>;
  terminalSides: Record<string, GraphSide>;
  collapsed: boolean;
}

export interface InstalledLayoutRecipe {
  id: string;
  layout: RecipeLayout;
  name: string;
}

export interface LayoutCompositeBoundary {
  ingredients: IngredientPrototype[];
  results: ProductPrototype[];
}

export interface FilterState {
  locations: string[];
  categories: string[];
  madeByNoByproducts: boolean;
  usedInNoCoInputs: boolean;
  includeMining: boolean;
  includeRecycling: boolean;
  includeTechnology: boolean;
  includeLocked: boolean;
}
