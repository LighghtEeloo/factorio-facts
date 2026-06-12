import {
  DataRawDump,
  EntityKey,
  EntityRef,
  ProductPrototype,
  RecipeId,
  RecipePrototype,
  entityKey,
} from "./prototypes";

export interface RecipeBook {
  recipes: RecipePrototype[];
  recipesByName: ReadonlyMap<RecipeId, RecipePrototype>;
  madeBy: ReadonlyMap<EntityKey, RecipePrototype[]>;
  usedIn: ReadonlyMap<EntityKey, RecipePrototype[]>;
}

export interface ConnectedRecipes {
  entity: EntityRef;
  madeBy: RecipePrototype[];
  usedIn: RecipePrototype[];
}

export function extractRecipes(dataRaw: DataRawDump): RecipePrototype[] {
  return Object.values(dataRaw.recipe ?? {}).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function createRecipeBook(recipes: Iterable<RecipePrototype>): RecipeBook {
  const recipeList = [...recipes];
  const recipesByName = new Map<RecipeId, RecipePrototype>();
  const madeBy = new Map<EntityKey, RecipePrototype[]>();
  const usedIn = new Map<EntityKey, RecipePrototype[]>();

  for (const recipe of recipeList) {
    recipesByName.set(recipe.name, recipe);

    for (const ingredient of recipe.ingredients ?? []) {
      pushGrouped(usedIn, entityKey(ingredient), recipe);
    }

    for (const product of recipe.results ?? []) {
      pushGrouped(madeBy, entityKey(product), recipe);
    }
  }

  return { recipes: recipeList, recipesByName, madeBy, usedIn };
}

export function connectedRecipes(
  book: RecipeBook,
  entity: EntityRef,
): ConnectedRecipes {
  const key = entityKey(entity);

  return {
    entity,
    madeBy: book.madeBy.get(key) ?? [],
    usedIn: book.usedIn.get(key) ?? [],
  };
}

export function recipeProducts(recipe: RecipePrototype): ProductPrototype[] {
  return recipe.results ?? [];
}

function pushGrouped<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const group = map.get(key);

  if (group) {
    group.push(value);
  } else {
    map.set(key, [value]);
  }
}
