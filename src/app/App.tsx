import { useMemo, useState } from "react";
import { Database, GitBranch, RotateCcw } from "lucide-react";
import type { RecipePrototype } from "../factorio/prototypes";
import {
  explorerData,
  getIconIdForItem,
  getRecipeMetadata,
} from "./data/factoriolab";
import type { FilterState } from "./types";
import { FilterPanel } from "./components/FilterPanel";
import { IconSprite } from "./components/IconSprite";
import { ItemSearch } from "./components/ItemSearch";
import { RecipeColumn } from "./components/RecipeColumn";
import "./styles.css";

const defaultFilters: FilterState = {
  location: "all",
  category: "all",
  includeMining: true,
  includeRecycling: false,
  includeTechnology: false,
  includeLocked: true,
};

export function App() {
  const [selectedItemId, setSelectedItemId] = useState("iron-plate");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const selectedItem = explorerData.itemById.get(selectedItemId) ?? explorerData.items[0];

  if (!selectedItem) {
    throw new Error("FactorioLab data did not include any items");
  }

  const madeBy = useMemo(
    () => filterRecipes(explorerData.madeBy(selectedItem.id), filters),
    [filters, selectedItem.id],
  );
  const usedIn = useMemo(
    () => filterRecipes(explorerData.usedIn(selectedItem.id), filters),
    [filters, selectedItem.id],
  );
  const selectedIcon = explorerData.iconById.get(getIconIdForItem(selectedItem));

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
    setQuery("");
  }

  return (
    <main className="app-shell">
      <ItemSearch
        data={explorerData}
        onQueryChange={setQuery}
        onSelect={selectItem}
        query={query}
        selectedItemId={selectedItem.id}
      />

      <section className="workspace">
        <header className="workspace-header app-panel">
          <div className="selected-item">
            <IconSprite
              atlas={explorerData.atlas}
              icon={selectedIcon}
              label={selectedItem.name}
              size={48}
            />
            <div>
              <h1>{selectedItem.name}</h1>
              <span>{selectedItem.id}</span>
            </div>
          </div>

          <div className="workspace-stats">
            <span>
              <GitBranch size={16} aria-hidden="true" />
              {madeBy.length} made by
            </span>
            <span>
              <GitBranch size={16} aria-hidden="true" />
              {usedIn.length} used in
            </span>
            <span>
              <Database size={16} aria-hidden="true" />
              {explorerData.recipes.length} recipes
            </span>
          </div>

          <button
            className="icon-button"
            type="button"
            title="Reset filters"
            onClick={() => setFilters(defaultFilters)}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="recipe-grid">
          <RecipeColumn
            data={explorerData}
            onSelectItem={selectItem}
            recipes={madeBy}
            selectedItemId={selectedItem.id}
            title="Made by"
          />
          <RecipeColumn
            data={explorerData}
            onSelectItem={selectItem}
            recipes={usedIn}
            selectedItemId={selectedItem.id}
            title="Used in"
          />
        </div>

        <footer className="data-footnote">{explorerData.versionLabel}</footer>
      </section>

      <FilterPanel data={explorerData} filters={filters} onChange={setFilters} />
    </main>
  );
}

function filterRecipes(recipes: RecipePrototype[], filters: FilterState): RecipePrototype[] {
  return recipes.filter((recipe) => {
    const metadata = getRecipeMetadata(recipe);

    if (filters.category !== "all" && metadata.category !== filters.category) {
      return false;
    }

    if (
      filters.location !== "all" &&
      metadata.locations.length > 0 &&
      !metadata.locations.includes(filters.location)
    ) {
      return false;
    }

    if (!filters.includeMining && metadata.flags.includes("mining")) {
      return false;
    }

    if (!filters.includeRecycling && metadata.flags.includes("recycling")) {
      return false;
    }

    if (!filters.includeTechnology && metadata.flags.includes("technology")) {
      return false;
    }

    if (!filters.includeLocked && metadata.flags.includes("locked")) {
      return false;
    }

    return true;
  });
}
