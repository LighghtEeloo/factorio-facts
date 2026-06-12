import rawData from "../../../data/vendor/factoriolab/spa/data.json";
import iconAtlasUrl from "../../../data/vendor/factoriolab/spa/icons.webp";
import {
  entityKey,
  type EntityKind,
  type RecipePrototype,
} from "../../factorio/prototypes";
import { createRecipeBook } from "../../factorio/recipe-book";
import {
  createItemKindLookup,
  convertFactorioLabRecipe,
} from "../../factoriolab/adapter";
import type {
  FactorioLabCategory,
  FactorioLabData,
  FactorioLabIcon,
  FactorioLabItem,
  FactorioLabLocation,
  FactorioLabRecipeMetadata,
} from "../../factoriolab/types";

export interface RecipeExplorerData {
  atlas: {
    url: string;
    width: number;
    height: number;
    cellSize: number;
  };
  categories: FactorioLabCategory[];
  iconById: ReadonlyMap<string, FactorioLabIcon>;
  itemById: ReadonlyMap<string, FactorioLabItem>;
  items: FactorioLabItem[];
  itemKindById: ReadonlyMap<string, EntityKind>;
  locationById: ReadonlyMap<string, FactorioLabLocation>;
  locations: FactorioLabLocation[];
  recipes: RecipePrototype[];
  versionLabel: string;
  madeBy(itemId: string): RecipePrototype[];
  usedIn(itemId: string): RecipePrototype[];
}

const factorioLabData = rawData as FactorioLabData;

export const explorerData = createExplorerData(factorioLabData);

export function getRecipeMetadata(recipe: RecipePrototype): FactorioLabRecipeMetadata {
  return recipe.factoriolab as FactorioLabRecipeMetadata;
}

export function getItemKind(
  item: FactorioLabItem,
  itemKindById: ReadonlyMap<string, EntityKind>,
): EntityKind {
  return itemKindById.get(item.id) ?? (item.category === "fluids" ? "fluid" : "item");
}

export function getIconIdForItem(item: FactorioLabItem): string {
  return item.icon ?? item.id;
}

function createExplorerData(data: FactorioLabData): RecipeExplorerData {
  const itemKindById = createItemKindLookup(data.items);
  const recipes = data.recipes.map((recipe) =>
    convertFactorioLabRecipe(recipe, itemKindById),
  );
  const recipeBook = createRecipeBook(recipes);
  const itemById = new Map(data.items.map((item) => [item.id, item]));
  const iconById = new Map(data.icons.map((icon) => [icon.id, icon]));
  const locationById = new Map(data.locations.map((location) => [location.id, location]));

  return {
    atlas: {
      url: iconAtlasUrl,
      width: 2044,
      height: 1978,
      cellSize: 64,
    },
    categories: data.categories,
    iconById,
    itemById,
    items: [...data.items].sort((left, right) => left.name.localeCompare(right.name)),
    itemKindById,
    locationById,
    locations: data.locations,
    recipes,
    versionLabel: formatVersionLabel(data.version),
    madeBy(itemId) {
      const kind = itemKindById.get(itemId);

      if (!kind) {
        return [];
      }

      return recipeBook.madeBy.get(entityKey({ type: kind, name: itemId })) ?? [];
    },
    usedIn(itemId) {
      const kind = itemKindById.get(itemId);

      if (!kind) {
        return [];
      }

      return recipeBook.usedIn.get(entityKey({ type: kind, name: itemId })) ?? [];
    },
  };
}

function formatVersionLabel(version: FactorioLabData["version"]): string {
  return Object.entries(version)
    .filter(([, value]) => value)
    .map(([mod, value]) => `${mod} ${value}`)
    .join(" / ");
}
