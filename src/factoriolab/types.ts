export type FactorioLabId = string;
export type FactorioLabAmountMap = Record<FactorioLabId, number>;

export interface FactorioLabVersion {
  base: string;
  "elevated-rails"?: string;
  quality?: string;
  "space-age"?: string;
  [modId: string]: string | undefined;
}

export interface FactorioLabCategory {
  id: FactorioLabId;
  name: string;
  icon?: FactorioLabId;
}

export interface FactorioLabIcon {
  id: FactorioLabId;
  x: number;
  y: number;
}

export type FactorioLabModuleEffect =
  | "consumption"
  | "pollution"
  | "productivity"
  | "quality"
  | "speed";

export interface FactorioLabMachine {
  modules?: number | true;
  disallowedEffects?: FactorioLabModuleEffect[];
  speed?: number | string;
  usage?: number | string;
}

export interface FactorioLabModule {
  consumption?: number | string;
  pollution?: number | string;
  productivity?: number | string;
  quality?: number | string;
  speed?: number | string;
  limitation?: string;
}

export interface FactorioLabBeacon {
  effectivity: number | string;
  modules: number | string;
  range?: number | string;
  usage?: number | string;
  disallowedEffects?: FactorioLabModuleEffect[];
  profile?: number[];
}

export interface FactorioLabItem {
  id: FactorioLabId;
  name: string;
  category: FactorioLabId;
  stack?: number;
  row: number;
  rocketCapacity?: number;
  icon?: FactorioLabId;
  iconText?: string;
  fuel?: unknown;
  machine?: FactorioLabMachine;
  module?: FactorioLabModule;
  technology?: unknown;
  belt?: unknown;
  beacon?: FactorioLabBeacon;
  cargoWagon?: unknown;
  fluidWagon?: unknown;
  inserter?: unknown;
  pipe?: unknown;
}

export type FactorioLabRecipeFlag =
  | "burn"
  | "infinite"
  | "locked"
  | "mining"
  | "recycling"
  | "showCount"
  | "technology";

export type FactorioLabDisallowedEffect = FactorioLabModuleEffect;

export interface FactorioLabRecipe {
  id: FactorioLabId;
  name: string;
  category: FactorioLabId;
  row: number;
  time: number;
  producers?: FactorioLabId[];
  in: FactorioLabAmountMap;
  out: FactorioLabAmountMap;
  flags?: FactorioLabRecipeFlag[];
  locations?: FactorioLabId[];
  disallowedEffects?: FactorioLabDisallowedEffect[];
  catalyst?: FactorioLabAmountMap;
  cost?: number;
  icon?: FactorioLabId;
  iconText?: string;
}

export interface FactorioLabQuality {
  id: FactorioLabId;
  name: string;
  level: number;
}

export interface FactorioLabLocation {
  id: FactorioLabId;
  name: string;
  icon?: FactorioLabId;
}

export interface FactorioLabData {
  version: FactorioLabVersion;
  categories: FactorioLabCategory[];
  icons: FactorioLabIcon[];
  items: FactorioLabItem[];
  recipes: FactorioLabRecipe[];
  flags: string[];
  qualities: FactorioLabQuality[];
  locations: FactorioLabLocation[];
  defaults: unknown;
}

export interface FactorioLabRecipeMetadata {
  source: "factoriolab" | "composite";
  id: FactorioLabId;
  name: string;
  category: FactorioLabId;
  row: number;
  producers: FactorioLabId[];
  flags: FactorioLabRecipeFlag[];
  locations: FactorioLabId[];
  disallowedEffects: FactorioLabDisallowedEffect[];
  catalyst?: FactorioLabAmountMap;
  cost?: number;
  icon?: FactorioLabId;
  iconText?: string;
}
