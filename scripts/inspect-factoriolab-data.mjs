import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const selectedId = process.argv[2] ?? "iron-plate";
const dataPath = resolve("data/vendor/factoriolab/spa/data.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));

const itemById = new Map(data.items.map((item) => [item.id, item]));
const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
const madeBy = new Map();
const usedIn = new Map();

for (const recipe of data.recipes) {
  for (const itemId of Object.keys(recipe.in)) {
    pushGrouped(usedIn, itemId, recipe);
  }

  for (const itemId of Object.keys(recipe.out)) {
    pushGrouped(madeBy, itemId, recipe);
  }
}

const selectedItem = itemById.get(selectedId);

console.log(`FactorioLab Space Age data`);
console.log(`  versions: ${formatVersions(data.version)}`);
console.log(`  items: ${data.items.length}`);
console.log(`  recipes: ${data.recipes.length}`);
console.log(`  icons: ${data.icons.length}`);
console.log(`  locations: ${data.locations.length}`);
console.log("");
console.log(`Selected: ${selectedItem?.name ?? selectedId} (${selectedId})`);
console.log("");
printRecipeGroup("Made by", madeBy.get(selectedId) ?? []);
console.log("");
printRecipeGroup("Used in", usedIn.get(selectedId) ?? []);

if (!selectedItem && !recipeById.has(selectedId)) {
  process.exitCode = 1;
}

function pushGrouped(map, key, recipe) {
  const group = map.get(key);

  if (group) {
    group.push(recipe);
  } else {
    map.set(key, [recipe]);
  }
}

function formatVersions(version) {
  return Object.entries(version)
    .map(([name, value]) => `${name} ${value}`)
    .join(", ");
}

function printRecipeGroup(label, recipes) {
  console.log(`${label}: ${recipes.length}`);

  for (const recipe of recipes.slice(0, 20)) {
    console.log(`  - ${recipe.name} (${recipe.id})`);
  }

  if (recipes.length > 20) {
    console.log(`  ... ${recipes.length - 20} more`);
  }
}
