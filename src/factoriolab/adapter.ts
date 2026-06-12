import {
  DataRawDump,
  EntityKind,
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../factorio/prototypes";
import { createRecipeBook, RecipeBook } from "../factorio/recipe-book";
import {
  FactorioLabAmountMap,
  FactorioLabData,
  FactorioLabId,
  FactorioLabItem,
  FactorioLabRecipe,
  FactorioLabRecipeMetadata,
} from "./types";

export interface FactorioLabImportResult {
  dataRaw: DataRawDump;
  recipes: RecipePrototype[];
  recipeBook: RecipeBook;
}

export function importFactorioLabData(data: FactorioLabData): FactorioLabImportResult {
  const itemKinds = createItemKindLookup(data.items);
  const recipes = data.recipes.map((recipe) =>
    convertFactorioLabRecipe(recipe, itemKinds),
  );
  const dataRaw: DataRawDump = {
    recipe: Object.fromEntries(recipes.map((recipe) => [recipe.name, recipe])),
  };

  return {
    dataRaw,
    recipes,
    recipeBook: createRecipeBook(recipes),
  };
}

export function convertFactorioLabRecipe(
  recipe: FactorioLabRecipe,
  itemKinds: ReadonlyMap<FactorioLabId, EntityKind>,
): RecipePrototype {
  const disallowedEffects = recipe.disallowedEffects ?? [];
  const flags = recipe.flags ?? [];
  const metadata: FactorioLabRecipeMetadata = {
    source: "factoriolab",
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    row: recipe.row,
    producers: recipe.producers ?? [],
    flags,
    locations: recipe.locations ?? [],
    disallowedEffects,
    ...(recipe.catalyst ? { catalyst: recipe.catalyst } : {}),
    ...(recipe.cost !== undefined ? { cost: recipe.cost } : {}),
    ...(recipe.icon ? { icon: recipe.icon } : {}),
    ...(recipe.iconText ? { iconText: recipe.iconText } : {}),
  };

  return {
    type: "recipe",
    name: recipe.id,
    localised_name: recipe.name,
    energy_required: recipe.time,
    ingredients: convertIngredients(recipe.in, itemKinds),
    results: convertProducts(recipe.out, itemKinds),
    ...(flags.includes("locked") ? { enabled: false } : {}),
    ...(disallowedEffects.includes("productivity")
      ? { allow_productivity: false }
      : {}),
    ...(disallowedEffects.includes("quality") ? { allow_quality: false } : {}),
    factoriolab: metadata,
  };
}

export function createItemKindLookup(
  items: Iterable<FactorioLabItem>,
): ReadonlyMap<FactorioLabId, EntityKind> {
  const itemKinds = new Map<FactorioLabId, EntityKind>();

  for (const item of items) {
    itemKinds.set(item.id, item.category === "fluids" ? "fluid" : "item");
  }

  return itemKinds;
}

function convertIngredients(
  amounts: FactorioLabAmountMap,
  itemKinds: ReadonlyMap<FactorioLabId, EntityKind>,
): IngredientPrototype[] {
  return Object.entries(amounts)
    .sort(compareAmountEntries)
    .map(([name, amount]) => ({
      type: getItemKind(name, itemKinds),
      name,
      amount,
    }));
}

function convertProducts(
  amounts: FactorioLabAmountMap,
  itemKinds: ReadonlyMap<FactorioLabId, EntityKind>,
): ProductPrototype[] {
  return Object.entries(amounts)
    .sort(compareAmountEntries)
    .map(([name, amount]) => ({
      type: getItemKind(name, itemKinds),
      name,
      amount,
    }));
}

function getItemKind(
  itemId: FactorioLabId,
  itemKinds: ReadonlyMap<FactorioLabId, EntityKind>,
): EntityKind {
  const kind = itemKinds.get(itemId);

  if (!kind) {
    throw new Error(`FactorioLab recipe references unknown item: ${itemId}`);
  }

  return kind;
}

function compareAmountEntries(
  [leftName]: readonly [string, number],
  [rightName]: readonly [string, number],
): number {
  return leftName.localeCompare(rightName);
}
