import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  ListTree,
  Rows3,
} from "lucide-react";
import type { RecipePrototype } from "../factorio/prototypes";
import {
  explorerData,
  getIconIdForItem,
  getRecipeMetadata,
} from "./data/factoriolab";
import type { FilterState, ViewMode } from "./types";
import { FilterPanel } from "./components/FilterPanel";
import { IconSprite } from "./components/IconSprite";
import { ItemSearch } from "./components/ItemSearch";
import { RecipeColumn } from "./components/RecipeColumn";
import { TooltipLayer } from "./components/TooltipLayer";
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
  const [viewMode, setViewMode] = useState<ViewMode>("concise");
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
              <ArrowDownToLine size={16} aria-hidden="true" />
              {madeBy.length} made by
            </span>
            <span>
              <ArrowUpFromLine size={16} aria-hidden="true" />
              {usedIn.length} used in
            </span>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </header>

        <div className="recipe-grid">
          <RecipeColumn
            data={explorerData}
            onSelectItem={selectItem}
            recipes={madeBy}
            selectedItemId={selectedItem.id}
            viewMode={viewMode}
            variant="made-by"
            title="Made by"
          />
          <RecipeColumn
            data={explorerData}
            onSelectItem={selectItem}
            recipes={usedIn}
            selectedItemId={selectedItem.id}
            viewMode={viewMode}
            variant="used-in"
            title="Used in"
          />
        </div>

        <footer className="data-footnote">
          <span className="data-footnote__version">{explorerData.versionLabel}</span>
          <span className="data-footnote__separator">/</span>
          <span className="data-footnote__recipes">
            <Database size={14} aria-hidden="true" />
            {explorerData.recipes.length} recipes
          </span>
        </footer>
      </section>

      <FilterPanel
        data={explorerData}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />
      <TooltipLayer />
    </main>
  );
}

interface ViewModeToggleProps {
  value: ViewMode;
  onChange(value: ViewMode): void;
}

function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="Recipe detail level">
      <button
        aria-pressed={value === "concise"}
        className={value === "concise" ? "view-toggle__button--active" : ""}
        type="button"
        title="Concise icon pills"
        onClick={() => onChange("concise")}
      >
        <Rows3 size={15} aria-hidden="true" />
        Concise
      </button>
      <button
        aria-pressed={value === "detailed"}
        className={value === "detailed" ? "view-toggle__button--active" : ""}
        type="button"
        title="Detailed recipe cards"
        onClick={() => onChange("detailed")}
      >
        <ListTree size={15} aria-hidden="true" />
        Detailed
      </button>
    </div>
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
