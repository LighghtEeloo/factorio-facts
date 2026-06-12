import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  ListTree,
  Package,
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
  locations: [],
  categories: [],
  includeMining: true,
  includeRecycling: false,
  includeTechnology: false,
  includeLocked: true,
};

const defaultViewMode: ViewMode = "concise";

interface AppUrlState {
  selectedItemId: string | null;
  filters: FilterState;
  viewMode: ViewMode;
}

export function App() {
  const initialUrlState = useMemo(readAppStateFromUrl, []);
  const [selectedItemId, setSelectedItemId] = useState(initialUrlState.selectedItemId);
  const [filters, setFilters] = useState<FilterState>(initialUrlState.filters);
  const [viewMode, setViewMode] = useState<ViewMode>(initialUrlState.viewMode);
  const selectedItem = selectedItemId
    ? explorerData.itemById.get(selectedItemId) ?? null
    : null;

  if (!explorerData.items.length) {
    throw new Error("FactorioLab data did not include any items");
  }

  const madeBy = useMemo(
    () => (selectedItem ? filterRecipes(explorerData.madeBy(selectedItem.id), filters) : []),
    [filters, selectedItem],
  );
  const usedIn = useMemo(
    () => (selectedItem ? filterRecipes(explorerData.usedIn(selectedItem.id), filters) : []),
    [filters, selectedItem],
  );
  const selectedIcon = selectedItem
    ? explorerData.iconById.get(getIconIdForItem(selectedItem))
    : undefined;

  useEffect(() => {
    updateUrlFromAppState({ selectedItemId, filters, viewMode });
  }, [filters, selectedItemId, viewMode]);

  useEffect(() => {
    function handlePopState() {
      const nextState = readAppStateFromUrl();

      setSelectedItemId(nextState.selectedItemId);
      setFilters(nextState.filters);
      setViewMode(nextState.viewMode);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
  }

  return (
    <main className="app-shell">
      <ItemSearch
        data={explorerData}
        onSelect={selectItem}
        selectedItemId={selectedItem?.id ?? null}
      />

      <section className={`workspace ${selectedItem ? "" : "workspace--empty"}`}>
        {selectedItem ? (
          <>
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
          </>
        ) : (
          <div className="workspace-empty app-panel">
            <Package size={40} aria-hidden="true" />
            <div>
              <h1>Select item</h1>
              <span>No item selected</span>
            </div>
          </div>
        )}

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

function readAppStateFromUrl(): AppUrlState {
  const params = new URLSearchParams(window.location.search);
  const selectedItemId = parseItemId(params.get("item"));
  const viewMode = parseViewMode(params.get("view"));

  return {
    selectedItemId,
    filters: {
      locations: parseIdList(params, "surface", (id) => explorerData.locationById.has(id)),
      categories: parseIdList(params, "category", (id) =>
        explorerData.categories.some((category) => category.id === id),
      ),
      includeMining: parseBooleanParam(
        params,
        "mining",
        defaultFilters.includeMining,
      ),
      includeRecycling: parseBooleanParam(
        params,
        "recycling",
        defaultFilters.includeRecycling,
      ),
      includeTechnology: parseBooleanParam(
        params,
        "technology",
        defaultFilters.includeTechnology,
      ),
      includeLocked: parseBooleanParam(
        params,
        "locked",
        defaultFilters.includeLocked,
      ),
    },
    viewMode,
  };
}

function updateUrlFromAppState(state: AppUrlState) {
  const params = new URLSearchParams();

  if (state.selectedItemId) {
    params.set("item", state.selectedItemId);
  }

  if (state.viewMode !== defaultViewMode) {
    params.set("view", state.viewMode);
  }

  setListParam(params, "surface", state.filters.locations);
  setListParam(params, "category", state.filters.categories);
  setBooleanParam(
    params,
    "mining",
    state.filters.includeMining,
    defaultFilters.includeMining,
  );
  setBooleanParam(
    params,
    "recycling",
    state.filters.includeRecycling,
    defaultFilters.includeRecycling,
  );
  setBooleanParam(
    params,
    "technology",
    state.filters.includeTechnology,
    defaultFilters.includeTechnology,
  );
  setBooleanParam(
    params,
    "locked",
    state.filters.includeLocked,
    defaultFilters.includeLocked,
  );

  const nextSearch = params.toString().replaceAll("%2C", ",");
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function parseItemId(value: string | null): string | null {
  return value && explorerData.itemById.has(value) ? value : null;
}

function parseViewMode(value: string | null): ViewMode {
  return value === "detailed" || value === "concise" ? value : defaultViewMode;
}

function parseBooleanParam(
  params: URLSearchParams,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = params.get(key);

  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return defaultValue;
}

function parseIdList(
  params: URLSearchParams,
  key: string,
  isAllowed: (id: string) => boolean,
): string[] {
  const values = params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueValues = new Set<string>();

  for (const value of values) {
    if (isAllowed(value)) {
      uniqueValues.add(value);
    }
  }

  return [...uniqueValues];
}

function setListParam(params: URLSearchParams, key: string, values: string[]) {
  if (values.length > 0) {
    params.set(key, values.join(","));
  }
}

function setBooleanParam(
  params: URLSearchParams,
  key: string,
  value: boolean,
  defaultValue: boolean,
) {
  if (value !== defaultValue) {
    params.set(key, value ? "1" : "0");
  }
}

function filterRecipes(recipes: RecipePrototype[], filters: FilterState): RecipePrototype[] {
  return recipes.filter((recipe) => {
    const metadata = getRecipeMetadata(recipe);

    if (
      filters.categories.length > 0 &&
      !filters.categories.includes(metadata.category)
    ) {
      return false;
    }

    if (
      filters.locations.length > 0 &&
      metadata.locations.length > 0 &&
      !filters.locations.some((location) => metadata.locations.includes(location))
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
