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
import type {
  FilterState,
  GraphNodePosition,
  LayoutReorderPlacement,
  RecipeLayout,
  RecipeLayoutEntry,
  ViewMode,
} from "./types";
import { FilterPanel } from "./components/FilterPanel";
import { IconSprite } from "./components/IconSprite";
import { LayoutGraphDialog } from "./components/LayoutGraphDialog";
import { LayoutSidebar } from "./components/LayoutSidebar";
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
const defaultLayoutId = "layout-1";

let nextLayoutSequence = 2;
let nextLayoutEntrySequence = 1;

interface AppUrlState {
  selectedItemId: string | null;
  filters: FilterState;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  viewMode: ViewMode;
}

export function App() {
  const initialUrlState = useMemo(readAppStateFromUrl, []);
  const [selectedItemId, setSelectedItemId] = useState(initialUrlState.selectedItemId);
  const [filters, setFilters] = useState<FilterState>(initialUrlState.filters);
  const [focusedLayoutId, setFocusedLayoutId] = useState(initialUrlState.focusedLayoutId);
  const [layouts, setLayouts] = useState<RecipeLayout[]>(initialUrlState.layouts);
  const [graphLayoutId, setGraphLayoutId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialUrlState.viewMode);
  const selectedItem = selectedItemId
    ? explorerData.itemById.get(selectedItemId) ?? null
    : null;
  const focusedLayout = layouts.find((layout) => layout.id === focusedLayoutId) ?? layouts[0];
  const graphLayout = graphLayoutId
    ? layouts.find((layout) => layout.id === graphLayoutId) ?? null
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
    updateUrlFromAppState({ selectedItemId, filters, focusedLayoutId, layouts, viewMode });
  }, [filters, focusedLayoutId, layouts, selectedItemId, viewMode]);

  useEffect(() => {
    function handlePopState() {
      const nextState = readAppStateFromUrl();

      setSelectedItemId(nextState.selectedItemId);
      setFilters(nextState.filters);
      setFocusedLayoutId(nextState.focusedLayoutId);
      setLayouts(nextState.layouts);
      setGraphLayoutId(null);
      setViewMode(nextState.viewMode);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
  }

  function createLayout() {
    const layout = createEmptyLayout(createLayoutId());

    setLayouts((currentLayouts) => [...currentLayouts, layout]);
    setFocusedLayoutId(layout.id);
  }

  function renameLayout(layoutId: string, name: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId ? { ...layout, name } : layout,
      ),
    );
  }

  function focusLayout(layoutId: string) {
    setFocusedLayoutId(layoutId);
  }

  function toggleLayoutCollapsed(layoutId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId ? { ...layout, collapsed: !layout.collapsed } : layout,
      ),
    );
  }

  function addRecipeToFocusedLayout(recipeId: string) {
    if (!focusedLayout || !explorerData.recipeById.has(recipeId)) {
      return;
    }

    const entry = createLayoutEntry(recipeId);

    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === focusedLayout.id
          ? { ...layout, collapsed: false, entries: [...layout.entries, entry] }
          : layout,
      ),
    );
  }

  function removeRecipeFromLayout(layoutId: string, entryId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              entries: layout.entries.filter((entry) => entry.id !== entryId),
              graphPositions: omitGraphPosition(layout.graphPositions, entryId),
            }
          : layout,
      ),
    );
  }

  function reorderRecipeInLayout(
    layoutId: string,
    sourceEntryId: string,
    targetEntryId: string,
    placement: LayoutReorderPlacement,
  ) {
    if (sourceEntryId === targetEntryId) {
      return;
    }

    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const sourceIndex = layout.entries.findIndex(
          (entry) => entry.id === sourceEntryId,
        );
        const targetIndex = layout.entries.findIndex(
          (entry) => entry.id === targetEntryId,
        );

        if (sourceIndex < 0 || targetIndex < 0) {
          return layout;
        }

        const nextEntries = [...layout.entries];
        const [sourceEntry] = nextEntries.splice(sourceIndex, 1);
        const shiftedTargetIndex = nextEntries.findIndex(
          (entry) => entry.id === targetEntryId,
        );

        if (!sourceEntry || shiftedTargetIndex < 0) {
          return layout;
        }

        const insertIndex =
          shiftedTargetIndex + (placement === "after" ? 1 : 0);

        nextEntries.splice(insertIndex, 0, sourceEntry);

        return { ...layout, entries: nextEntries };
      }),
    );
  }

  function deleteLayout(layoutId: string) {
    const remainingLayouts = layouts.filter((layout) => layout.id !== layoutId);
    const nextLayouts = remainingLayouts.length
      ? remainingLayouts
      : [createEmptyLayout(createLayoutId())];
    const nextFocusedLayoutId = nextLayouts.some((layout) => layout.id === focusedLayoutId)
      ? focusedLayoutId
      : nextLayouts[0]?.id ?? defaultLayoutId;

    setLayouts(nextLayouts);
    setFocusedLayoutId(nextFocusedLayoutId);

    if (graphLayoutId === layoutId) {
      setGraphLayoutId(null);
    }
  }

  function getFocusedLayoutRecipeCount(recipeId: string): number {
    return (
      focusedLayout?.entries.filter((entry) => entry.recipeId === recipeId).length ?? 0
    );
  }

  function updateLayoutGraphNodePosition(
    layoutId: string,
    entryId: string,
    position: GraphNodePosition,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              graphPositions: {
                ...layout.graphPositions,
                [entryId]: {
                  x: Math.round(position.x),
                  y: Math.round(position.y),
                },
              },
            }
          : layout,
      ),
    );
  }

  function resetLayoutGraphPositions(layoutId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId ? { ...layout, graphPositions: {} } : layout,
      ),
    );
  }

  return (
    <main className="app-shell">
      <LayoutSidebar
        data={explorerData}
        focusedLayoutId={focusedLayout?.id ?? defaultLayoutId}
        layouts={layouts}
        onCreateLayout={createLayout}
        onDeleteLayout={deleteLayout}
        onFocusLayout={focusLayout}
        onOpenLayoutGraph={setGraphLayoutId}
        onRemoveRecipeFromLayout={removeRecipeFromLayout}
        onRenameLayout={renameLayout}
        onReorderRecipeInLayout={reorderRecipeInLayout}
        onToggleLayoutCollapsed={toggleLayoutCollapsed}
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
                getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
                onAddRecipeToLayout={addRecipeToFocusedLayout}
                onSelectItem={selectItem}
                recipes={madeBy}
                selectedItemId={selectedItem.id}
                viewMode={viewMode}
                variant="made-by"
                title="Made by"
              />
              <RecipeColumn
                data={explorerData}
                getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
                onAddRecipeToLayout={addRecipeToFocusedLayout}
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
      {graphLayout ? (
        <LayoutGraphDialog
          data={explorerData}
          layout={graphLayout}
          onClose={() => setGraphLayoutId(null)}
          onNodePositionChange={(entryId, position) =>
            updateLayoutGraphNodePosition(graphLayout.id, entryId, position)
          }
          onResetGraphPositions={() => resetLayoutGraphPositions(graphLayout.id)}
          onSelectItem={(itemId) => {
            selectItem(itemId);
            setGraphLayoutId(null);
          }}
        />
      ) : null}
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
  const layoutState = parseLayoutState(params.get("layouts"));

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
    focusedLayoutId: layoutState.focusedLayoutId,
    layouts: layoutState.layouts,
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

  if (!isDefaultLayoutState(state.layouts, state.focusedLayoutId)) {
    params.set("layouts", serializeLayoutState(state.layouts, state.focusedLayoutId));
  }

  const nextSearch = params.toString().replaceAll("%2C", ",");
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

interface ParsedLayoutState {
  focusedLayoutId: string;
  layouts: RecipeLayout[];
}

interface SerializedLayoutState {
  f?: unknown;
  l?: unknown;
}

interface SerializedLayout {
  c?: unknown;
  e?: unknown;
  i?: unknown;
  n?: unknown;
  p?: unknown;
}

interface SerializedLayoutEntry {
  i?: unknown;
  r?: unknown;
}

function parseLayoutState(value: string | null): ParsedLayoutState {
  if (!value) {
    const layout = createEmptyLayout(defaultLayoutId);

    return { focusedLayoutId: layout.id, layouts: [layout] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return defaultLayoutState();
    }

    const { f: rawFocusedLayoutId, l: rawLayouts } = parsed as SerializedLayoutState;
    const seenLayoutIds = new Set<string>();
    const layouts = Array.isArray(rawLayouts)
      ? rawLayouts.flatMap((rawLayout, index) =>
          parseLayout(rawLayout, index, seenLayoutIds),
        )
      : [];

    if (!layouts.length) {
      return defaultLayoutState();
    }

    const focusedLayoutId =
      typeof rawFocusedLayoutId === "string" &&
      layouts.some((layout) => layout.id === rawFocusedLayoutId)
        ? rawFocusedLayoutId
        : layouts[0]?.id ?? defaultLayoutId;

    return { focusedLayoutId, layouts };
  } catch {
    return defaultLayoutState();
  }
}

function parseLayout(
  rawLayout: unknown,
  index: number,
  seenLayoutIds: Set<string>,
): RecipeLayout[] {
  if (!isRecord(rawLayout)) {
    return [];
  }

  const {
    c: rawCollapsed,
    e: rawEntries,
    i: rawId,
    n: rawName,
    p: rawGraphPositions,
  } = rawLayout as SerializedLayout;
  const id = getUniqueId(
    typeof rawId === "string" && rawId ? rawId : `layout-${index + 1}`,
    seenLayoutIds,
  );
  const seenEntryIds = new Set<string>();
  const entries = Array.isArray(rawEntries)
    ? rawEntries.flatMap((rawEntry, entryIndex) =>
        parseLayoutEntry(rawEntry, entryIndex, seenEntryIds),
      )
    : [];

  return [
    {
      id,
      name: typeof rawName === "string" ? rawName : "",
      entries,
      graphPositions: parseGraphPositions(rawGraphPositions, entries),
      collapsed: rawCollapsed === 1 || rawCollapsed === true,
    },
  ];
}

function parseGraphPositions(
  value: unknown,
  entries: RecipeLayoutEntry[],
): Record<string, GraphNodePosition> {
  if (!isRecord(value)) {
    return {};
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  const graphPositions: Record<string, GraphNodePosition> = {};

  for (const [entryId, rawPosition] of Object.entries(value)) {
    if (!entryIds.has(entryId) || !Array.isArray(rawPosition)) {
      continue;
    }

    const [rawX, rawY] = rawPosition;

    if (typeof rawX !== "number" || typeof rawY !== "number") {
      continue;
    }

    graphPositions[entryId] = {
      x: Math.round(rawX),
      y: Math.round(rawY),
    };
  }

  return graphPositions;
}

function parseLayoutEntry(
  rawEntry: unknown,
  index: number,
  seenEntryIds: Set<string>,
): RecipeLayoutEntry[] {
  let rawId: unknown;
  let rawRecipeId: unknown;

  if (Array.isArray(rawEntry)) {
    rawId = rawEntry[0];
    rawRecipeId = rawEntry[1];
  } else if (isRecord(rawEntry)) {
    const entry = rawEntry as SerializedLayoutEntry;

    rawId = entry.i;
    rawRecipeId = entry.r;
  }

  if (typeof rawRecipeId !== "string" || !explorerData.recipeById.has(rawRecipeId)) {
    return [];
  }

  return [
    {
      id: getUniqueId(
        typeof rawId === "string" && rawId ? rawId : `entry-${index + 1}`,
        seenEntryIds,
      ),
      recipeId: rawRecipeId,
    },
  ];
}

function serializeLayoutState(layouts: RecipeLayout[], focusedLayoutId: string): string {
  return JSON.stringify({
    f: focusedLayoutId,
    l: layouts.map((layout) => ({
      i: layout.id,
      n: layout.name,
      c: layout.collapsed ? 1 : 0,
      e: layout.entries.map((entry) => [entry.id, entry.recipeId]),
      p: serializeGraphPositions(layout),
    })),
  });
}

function serializeGraphPositions(
  layout: RecipeLayout,
): Record<string, [number, number]> | undefined {
  const entryIds = new Set(layout.entries.map((entry) => entry.id));
  const graphPositions: Record<string, [number, number]> = {};

  for (const [entryId, position] of Object.entries(layout.graphPositions)) {
    if (!entryIds.has(entryId)) {
      continue;
    }

    graphPositions[entryId] = [Math.round(position.x), Math.round(position.y)];
  }

  return Object.keys(graphPositions).length ? graphPositions : undefined;
}

function isDefaultLayoutState(
  layouts: RecipeLayout[],
  focusedLayoutId: string,
): boolean {
  const layout = layouts[0];

  return (
    layouts.length === 1 &&
    focusedLayoutId === defaultLayoutId &&
    layout?.id === defaultLayoutId &&
    layout.name === "" &&
    !layout.collapsed &&
    layout.entries.length === 0 &&
    Object.keys(layout.graphPositions).length === 0
  );
}

function defaultLayoutState(): ParsedLayoutState {
  const layout = createEmptyLayout(defaultLayoutId);

  return { focusedLayoutId: layout.id, layouts: [layout] };
}

function createEmptyLayout(id: string): RecipeLayout {
  return {
    id,
    name: "",
    entries: [],
    graphPositions: {},
    collapsed: false,
  };
}

function createLayoutEntry(recipeId: string): RecipeLayoutEntry {
  return {
    id: createLayoutEntryId(),
    recipeId,
  };
}

function createLayoutId(): string {
  return `layout-${Date.now().toString(36)}-${nextLayoutSequence++}`;
}

function createLayoutEntryId(): string {
  return `entry-${Date.now().toString(36)}-${nextLayoutEntrySequence++}`;
}

function omitGraphPosition(
  graphPositions: Record<string, GraphNodePosition>,
  entryId: string,
): Record<string, GraphNodePosition> {
  const { [entryId]: _removedPosition, ...remainingPositions } = graphPositions;

  return remainingPositions;
}

function getUniqueId(id: string, seenIds: Set<string>): string {
  if (!seenIds.has(id)) {
    seenIds.add(id);
    return id;
  }

  let suffix = 2;
  let nextId = `${id}-${suffix}`;

  while (seenIds.has(nextId)) {
    suffix += 1;
    nextId = `${id}-${suffix}`;
  }

  seenIds.add(nextId);
  return nextId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
