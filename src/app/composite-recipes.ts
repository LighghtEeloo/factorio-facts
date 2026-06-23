import type { FactorioLabRecipeMetadata } from "../factoriolab/types";
import {
  entitiesCanFlow,
  entityKey,
  type EntityKey,
  type IngredientPrototype,
  type ProductPrototype,
  type RecipePrototype,
} from "../factorio/prototypes";
import { createRecipeBook } from "../factorio/recipe-book";
import {
  getIconIdForItemId,
  type RecipeExplorerData,
} from "./data/factoriolab";
import type {
  GraphRelay,
  GraphTerminalKind,
  InstalledLayoutRecipe,
  LayoutCompositeBoundary,
  RecipeLayout,
} from "./types";

export const compositeRecipeIdPrefix = "composite:";

const compositeRecipeCategory = "composite";

interface BoundaryNode {
  id: string;
  ingredients: IngredientPrototype[];
  results: ProductPrototype[];
}

interface BoundaryEdge {
  id: string;
  items: ProductPrototype[];
  sourceId: string;
  targetId: string;
}

export function isCompositeRecipeId(recipeId: string): boolean {
  return recipeId.startsWith(compositeRecipeIdPrefix);
}

export function isCompositeRecipe(recipe: RecipePrototype): boolean {
  return getRecipeSource(recipe) === "composite";
}

export function getRecipeSource(
  recipe: RecipePrototype,
): FactorioLabRecipeMetadata["source"] {
  const metadata = recipe.factoriolab;

  return isRecord(metadata) && metadata.source === "composite"
    ? "composite"
    : "factoriolab";
}

export function createRecipeExplorerDataWithInstalled(
  data: RecipeExplorerData,
  installedRecipes: InstalledLayoutRecipe[],
): RecipeExplorerData {
  const compositeRecipes = createCompositeRecipePrototypes(data, installedRecipes);
  const recipes = [...data.recipes, ...compositeRecipes];
  const recipeBook = createRecipeBook(recipes);
  const recipeById = new Map(data.recipeById);

  for (const recipe of compositeRecipes) {
    recipeById.set(recipe.name, recipe);
  }

  return {
    ...data,
    recipeById,
    recipes,
    madeBy(itemId) {
      const kind = data.itemKindById.get(itemId);

      if (!kind) {
        return [];
      }

      return recipeBook.madeBy.get(entityKey({ type: kind, name: itemId })) ?? [];
    },
    usedIn(itemId) {
      const kind = data.itemKindById.get(itemId);

      if (!kind) {
        return [];
      }

      return recipeBook.usedIn.get(entityKey({ type: kind, name: itemId })) ?? [];
    },
  };
}

export function createCompositeRecipePrototypes(
  data: RecipeExplorerData,
  installedRecipes: InstalledLayoutRecipe[],
): RecipePrototype[] {
  const recipeById = new Map(data.recipeById);
  const recipes: RecipePrototype[] = [];

  for (const installedRecipe of installedRecipes) {
    const recipe = createCompositeRecipePrototype(data, installedRecipe, recipeById);

    recipeById.set(recipe.name, recipe);
    recipes.push(recipe);
  }

  return recipes;
}

export function createCompositeRecipePrototype(
  data: RecipeExplorerData,
  installedRecipe: InstalledLayoutRecipe,
  recipeById: ReadonlyMap<string, RecipePrototype>,
): RecipePrototype {
  const boundary = inferLayoutCompositeBoundary(installedRecipe.layout, recipeById);
  const iconIds = getCompositeRecipeIconIds(
    data,
    boundary.results,
    installedRecipe.layout.iconIds,
    installedRecipe.layout.hiddenIconIds,
  );
  const name = getInstalledRecipeName(data, installedRecipe, boundary.results);
  const metadata: FactorioLabRecipeMetadata = {
    source: "composite",
    id: installedRecipe.id,
    name,
    category: compositeRecipeCategory,
    row: 0,
    producers: [],
    flags: [],
    locations: [],
    disallowedEffects: [],
    ...(iconIds[0] ? { icon: iconIds[0] } : {}),
  };

  return {
    type: "recipe",
    name: installedRecipe.id,
    ingredients: boundary.ingredients,
    results: boundary.results,
    ...(boundary.results[0] ? { main_product: boundary.results[0].name } : {}),
    ...(iconIds.length
      ? { icons: iconIds.map((icon) => ({ icon, icon_size: data.atlas.cellSize })) }
      : {}),
    factoriolab: metadata,
  };
}

export function inferLayoutCompositeBoundary(
  layout: RecipeLayout,
  recipeById: ReadonlyMap<string, RecipePrototype>,
): LayoutCompositeBoundary {
  const nodes = createBoundaryNodes(layout, recipeById);
  const activeEdges = createBoundaryEdges(nodes, layout.edgeItems);
  const incomingItems = new Map<string, ProductPrototype[]>();
  const outgoingItemKeys = new Map<string, Set<EntityKey>>();
  const ingredients: IngredientPrototype[] = [];
  const results: ProductPrototype[] = [];

  for (const edge of activeEdges) {
    for (const item of edge.items) {
      addSetValue(outgoingItemKeys, edge.sourceId, entityKey(item));
      addMapValue(incomingItems, edge.targetId, item);
    }
  }

  for (const node of nodes) {
    const forcedInputItemKeys = new Set(
      layout.externalItems[getGraphTerminalId(node.id, "input")] ?? [],
    );
    const forcedOutputItemKeys = new Set(
      layout.externalItems[getGraphTerminalId(node.id, "output")] ?? [],
    );
    const nodeIncomingItems = incomingItems.get(node.id) ?? [];
    const nodeOutgoingItemKeys = outgoingItemKeys.get(node.id) ?? new Set<string>();

    for (const entry of uniqueIngredients(node.ingredients)) {
      const itemKey = entityKey(entry);
      const required = !nodeIncomingItems.some((item) => entitiesCanFlow(item, entry));

      if (required || forcedInputItemKeys.has(itemKey)) {
        ingredients.push(entry);
      }
    }

    for (const entry of uniqueProducts(node.results)) {
      const itemKey = entityKey(entry);
      const required = !nodeOutgoingItemKeys.has(itemKey);

      if (required || forcedOutputItemKeys.has(itemKey)) {
        results.push(entry);
      }
    }
  }

  return {
    ingredients: uniqueIngredients(ingredients),
    results: uniqueProducts(results),
  };
}

export function getCompositeRecipeIconIds(
  data: RecipeExplorerData,
  results: readonly ProductPrototype[],
  preferredIconIds: readonly string[] = [],
  hiddenIconIds: readonly string[] = [],
): string[] {
  return getCompositeRecipeVisibleIconIds(
    data,
    results,
    preferredIconIds,
    hiddenIconIds,
  ).slice(0, 4);
}

export function getCompositeRecipeVisibleIconIds(
  data: RecipeExplorerData,
  results: readonly ProductPrototype[],
  preferredIconIds: readonly string[] = [],
  hiddenIconIds: readonly string[] = [],
): string[] {
  const hiddenIconIdSet = new Set(hiddenIconIds);

  return getCompositeRecipeOrderedIconIds(data, results, preferredIconIds).filter(
    (iconId) => !hiddenIconIdSet.has(iconId),
  );
}

export function getCompositeRecipeOrderedIconIds(
  data: RecipeExplorerData,
  results: readonly ProductPrototype[],
  preferredIconIds: readonly string[] = [],
): string[] {
  const outputIconIds = getCompositeRecipeOutputIconIds(data, results);
  const outputIconIdSet = new Set(outputIconIds);
  const preferredIconIdSet = new Set<string>();
  const preferredIcons: string[] = [];

  for (const iconId of preferredIconIds) {
    if (preferredIconIdSet.has(iconId) || !outputIconIdSet.has(iconId)) {
      continue;
    }

    preferredIconIdSet.add(iconId);
    preferredIcons.push(iconId);
  }

  return preferredIcons.length
    ? [
        ...preferredIcons,
        ...outputIconIds.filter((iconId) => !preferredIconIdSet.has(iconId)),
      ]
    : outputIconIds;
}

export function getCompositeRecipeOutputIconIds(
  data: RecipeExplorerData,
  results: readonly ProductPrototype[],
): string[] {
  const iconIds: string[] = [];
  const seenIconIds = new Set<string>();

  for (const result of results) {
    const iconId = getIconIdForItemId(data, result.name);

    if (seenIconIds.has(iconId)) {
      continue;
    }

    seenIconIds.add(iconId);
    iconIds.push(iconId);
  }

  return iconIds;
}

export function getRecipeLayoutTitle(
  data: RecipeExplorerData,
  layout: RecipeLayout,
  results?: readonly ProductPrototype[],
): string {
  return (
    layout.name.trim() ||
    getRecipeLayoutInferredTitle(data, layout, results) ||
    "Untitled layout"
  );
}

export function getRecipeLayoutInferredTitle(
  data: RecipeExplorerData,
  layout: RecipeLayout,
  results?: readonly ProductPrototype[],
): string | null {
  const boundaryResults =
    results ?? inferLayoutCompositeBoundary(layout, data.recipeById).results;
  const visibleIconIds = getCompositeRecipeIconIds(
    data,
    boundaryResults,
    layout.iconIds,
    layout.hiddenIconIds,
  );

  if (visibleIconIds.length !== 1) {
    return null;
  }

  const [visibleIconId] = visibleIconIds;
  const matchingProducts = uniqueProducts(
    boundaryResults.filter(
      (result) => getIconIdForItemId(data, result.name) === visibleIconId,
    ),
  );

  if (matchingProducts.length !== 1) {
    return null;
  }

  const [product] = matchingProducts;

  return product ? data.itemById.get(product.name)?.name ?? product.name : null;
}

export function getInstalledRecipeName(
  data: RecipeExplorerData,
  installedRecipe: InstalledLayoutRecipe,
  results?: readonly ProductPrototype[],
): string {
  return (
    installedRecipe.name.trim() ||
    getRecipeLayoutTitle(data, installedRecipe.layout, results)
  );
}

function createBoundaryNodes(
  layout: RecipeLayout,
  recipeById: ReadonlyMap<string, RecipePrototype>,
): BoundaryNode[] {
  return [
    ...layout.entries.flatMap((entry) => {
      const recipe = recipeById.get(entry.recipeId);

      return recipe
        ? [
            {
              id: entry.id,
              ingredients: recipe.ingredients ?? [],
              results: recipe.results ?? [],
            },
          ]
        : [];
    }),
    ...layout.relays.flatMap((relay) => createRelayBoundaryNode(relay)),
  ];
}

function createRelayBoundaryNode(relay: GraphRelay): BoundaryNode[] {
  const results = uniqueProducts(
    relay.itemKeys.flatMap((itemKey) => productFromEntityKey(itemKey) ?? []),
  );

  return results.length
    ? [
        {
          id: relay.id,
          ingredients: results.map(productToIngredient),
          results,
        },
      ]
    : [];
}

function createBoundaryEdges(
  nodes: BoundaryNode[],
  edgeItems: Record<string, string[]>,
): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];

  for (const source of nodes) {
    for (const target of nodes) {
      if (target.id === source.id) {
        continue;
      }

      const availableItems = uniqueProducts(
        source.results.filter((result) =>
          target.ingredients.some((ingredient) => entitiesCanFlow(result, ingredient)),
        ),
      );

      if (!availableItems.length) {
        continue;
      }

      const id = getGraphEdgeId(source.id, target.id);
      const selectedItemKeys = Object.prototype.hasOwnProperty.call(edgeItems, id)
        ? new Set(edgeItems[id])
        : null;
      const items = selectedItemKeys
        ? availableItems.filter((item) => selectedItemKeys.has(entityKey(item)))
        : availableItems;

      if (items.length) {
        edges.push({
          id,
          items,
          sourceId: source.id,
          targetId: target.id,
        });
      }
    }
  }

  return edges;
}

function productFromEntityKey(itemKey: string): ProductPrototype | null {
  const entity = parseEntityKey(itemKey);

  if (!entity) {
    return null;
  }

  return entity.type === "item"
    ? { type: "item", name: entity.name, amount: 1 }
    : { type: "fluid", name: entity.name, amount: 1 };
}

function productToIngredient(product: ProductPrototype): IngredientPrototype {
  return product.type === "item"
    ? { type: "item", name: product.name, amount: product.amount ?? 1 }
    : { type: "fluid", name: product.name, amount: product.amount ?? 1 };
}

function parseEntityKey(itemKey: string): { type: "item" | "fluid"; name: string } | null {
  const separator = itemKey.indexOf(":");

  if (separator <= 0 || separator >= itemKey.length - 1) {
    return null;
  }

  const type = itemKey.slice(0, separator);

  if (type !== "item" && type !== "fluid") {
    return null;
  }

  return {
    type,
    name: itemKey.slice(separator + 1),
  };
}

function uniqueIngredients(entries: IngredientPrototype[]): IngredientPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = entityKey(entry);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueProducts(entries: ProductPrototype[]): ProductPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = entityKey(entry);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getGraphEdgeId(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function getGraphTerminalId(entryId: string, kind: GraphTerminalKind): string {
  return `${entryId}:${kind}`;
}

function addSetValue<T>(map: Map<string, Set<T>>, key: string, value: T) {
  const values = map.get(key) ?? new Set<T>();

  values.add(value);
  map.set(key, values);
}

function addMapValue<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
