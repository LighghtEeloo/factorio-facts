export type PrototypeId = string;
export type ItemId = PrototypeId;
export type FluidId = PrototypeId;
export type RecipeId = PrototypeId;
export type RecipeCategoryId = PrototypeId;
export type TechnologyId = PrototypeId;
export type SurfacePropertyId = PrototypeId;

export type LocalisedString =
  | string
  | readonly [string, ...unknown[]]
  | readonly unknown[];

export interface PrototypeBase {
  type: string;
  name: PrototypeId;
  order?: string;
  localised_name?: LocalisedString;
  localised_description?: LocalisedString;
  hidden?: boolean;
  hidden_in_factoriopedia?: boolean;
  [field: string]: unknown;
}

export interface ItemIngredientPrototype {
  type: "item";
  name: ItemId;
  amount: number;
  ignored_by_stats?: number;
}

export interface FluidIngredientPrototype {
  type: "fluid";
  name: FluidId;
  amount: number;
  ignored_by_stats?: number;
  fluidbox_index?: number;
  minimum_temperature?: number;
  maximum_temperature?: number;
}

export type IngredientPrototype =
  | ItemIngredientPrototype
  | FluidIngredientPrototype;

export interface BaseProductPrototype {
  name: PrototypeId;
  amount?: number;
  amount_min?: number;
  amount_max?: number;
  probability?: number;
  ignored_by_productivity?: number;
  ignored_by_stats?: number;
  percent_spoiled?: number;
  show_details_in_recipe_tooltip?: boolean;
}

export interface ItemProductPrototype extends BaseProductPrototype {
  type: "item";
  name: ItemId;
}

export interface FluidProductPrototype extends BaseProductPrototype {
  type: "fluid";
  name: FluidId;
  temperature?: number;
  fluidbox_index?: number;
}

export type ProductPrototype = ItemProductPrototype | FluidProductPrototype;

export interface SurfaceCondition {
  property: SurfacePropertyId;
  min?: number;
  max?: number;
}

export interface IconData {
  icon: string;
  icon_size?: number;
  scale?: number;
  shift?: readonly [number, number];
  tint?: unknown;
  [field: string]: unknown;
}

export interface RecipePrototype extends PrototypeBase {
  type: "recipe";
  name: RecipeId;
  category?: RecipeCategoryId;
  additional_categories?: RecipeCategoryId[];
  icon?: string;
  icons?: IconData[];
  icon_size?: number;
  ingredients?: IngredientPrototype[];
  results?: ProductPrototype[];
  main_product?: string;
  energy_required?: number;
  enabled?: boolean;
  hide_from_stats?: boolean;
  hide_from_player_crafting?: boolean;
  hide_from_bonus_gui?: boolean;
  hide_from_signal_gui?: boolean;
  allow_decomposition?: boolean;
  allow_as_intermediate?: boolean;
  allow_intermediates?: boolean;
  always_show_made_in?: boolean;
  show_amount_in_title?: boolean;
  always_show_products?: boolean;
  unlock_results?: boolean;
  preserve_products_in_machine_output?: boolean;
  result_is_always_fresh?: boolean;
  reset_freshness_on_craft?: boolean;
  allow_consumption?: boolean;
  allow_speed?: boolean;
  allow_productivity?: boolean;
  allow_pollution?: boolean;
  allow_quality?: boolean;
  allowed_module_categories?: PrototypeId[];
  alternative_unlock_methods?: TechnologyId[];
  auto_recycle?: boolean;
  surface_conditions?: SurfaceCondition[];
}

export interface DataRawDump {
  recipe?: Record<RecipeId, RecipePrototype>;
  [prototypeType: string]: unknown;
}

export type EntityKind = IngredientPrototype["type"];

export interface EntityRef {
  type: EntityKind;
  name: PrototypeId;
}

export type EntityKey = `${EntityKind}:${PrototypeId}`;

export function entityKey(ref: EntityRef): EntityKey {
  return `${ref.type}:${ref.name}`;
}

export function entitiesCanFlow(
  product: ProductPrototype,
  ingredient: IngredientPrototype,
): boolean {
  if (product.type !== ingredient.type) {
    return false;
  }

  if (product.name === ingredient.name) {
    return true;
  }

  if (!isSteamVariant(product) || !isSteamVariant(ingredient)) {
    return false;
  }

  return steamTemperatureSatisfiesIngredient(product, ingredient);
}

function steamTemperatureSatisfiesIngredient(
  product: ProductPrototype,
  ingredient: IngredientPrototype,
): boolean {
  if (ingredient.type !== "fluid") {
    return false;
  }

  const productTemperature =
    product.type === "fluid" ? product.temperature ?? steamTemperature(product.name) : null;
  const hasTemperatureConstraint =
    typeof ingredient.minimum_temperature === "number" ||
    typeof ingredient.maximum_temperature === "number";

  if (hasTemperatureConstraint && productTemperature === null) {
    return false;
  }

  if (
    typeof ingredient.minimum_temperature === "number" &&
    productTemperature !== null &&
    productTemperature < ingredient.minimum_temperature
  ) {
    return false;
  }

  if (
    typeof ingredient.maximum_temperature === "number" &&
    productTemperature !== null &&
    productTemperature > ingredient.maximum_temperature
  ) {
    return false;
  }

  return true;
}

const steamVariantNames = ["steam", "steam-165"] as const;

function isSteamVariant(ref: EntityRef): boolean {
  return ref.type === "fluid" && steamVariantNames.includes(ref.name as SteamVariantName);
}

type SteamVariantName = (typeof steamVariantNames)[number];

function steamTemperature(name: PrototypeId): number | null {
  switch (name) {
    case "steam":
      return 500;
    case "steam-165":
      return 165;
    default:
      return null;
  }
}
