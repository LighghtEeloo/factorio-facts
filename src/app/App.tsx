import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Package,
} from "lucide-react";
import type {
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../factorio/prototypes";
import {
  explorerData,
  getIconIdForItem,
  getRecipeMetadata,
} from "./data/factoriolab";
import {
  compositeRecipeIdPrefix,
  createRecipeExplorerDataWithInstalled,
  isCompositeRecipeId,
} from "./composite-recipes";
import { defaultProductionSize } from "./types";
import type {
  AppView,
  FilterState,
  GraphEdgeRoute,
  GraphEdgePorts,
  GraphNodePosition,
  GraphRelay,
  GraphSide,
  GraphTerminalKind,
  InstalledLayoutRecipe,
  LayoutReorderPlacement,
  RecipeLayout,
  RecipeLayoutEntry,
} from "./types";
import { AppSidebar } from "./components/AppSidebar";
import { FilterPanel } from "./components/FilterPanel";
import { IconSprite } from "./components/IconSprite";
import { LayoutWorkspace } from "./components/LayoutWorkspace";
import { RecipeColumn } from "./components/RecipeColumn";
import { TooltipLayer } from "./components/TooltipLayer";
import {
  parseCompactLayoutState,
  serializeCompactLayoutState,
} from "./layout-url-codec";
import {
  getCompatibleGraphConnections,
  type GraphConnectionNode,
} from "./graph-connections";
import "./styles.css";

const defaultFilters: FilterState = {
  locations: [],
  categories: [],
  madeByNoByproducts: false,
  usedInNoCoInputs: false,
  includeMining: true,
  includeRecycling: false,
  includeTechnology: false,
  includeLocked: true,
};

const defaultAppView: AppView = "recipes";
const defaultLayoutId = "layout-1";
const graphHistoryLimit = 80;

const LayoutGraphDialog = lazy(() =>
  import("./components/LayoutGraphDialog").then((module) => ({
    default: module.LayoutGraphDialog,
  })),
);

let nextLayoutSequence = 2;
let nextLayoutEntrySequence = 1;
let nextInstalledRecipeSequence = 1;

interface AppUrlState {
  activeView: AppView;
  selectedItemId: string | null;
  filters: FilterState;
  focusedLayoutId: string;
  graphLayoutId: string | null;
  installedRecipes: InstalledLayoutRecipe[];
  layouts: RecipeLayout[];
}

interface GraphLayoutSnapshot {
  edgeItems: Record<string, string[]>;
  edgePorts: Record<string, GraphEdgePorts>;
  edgeRoutes: Record<string, GraphEdgeRoute>;
  externalItems: Record<string, string[]>;
  graphPositions: Record<string, GraphNodePosition>;
  relays: GraphRelay[];
  terminalSides: Record<string, GraphSide>;
}

interface GraphLayoutHistory {
  redo: GraphLayoutSnapshot[];
  undo: GraphLayoutSnapshot[];
}

export function App() {
  const initialUrlState = useMemo(readAppStateFromUrl, []);
  const [activeView, setActiveView] = useState<AppView>(initialUrlState.activeView);
  const [selectedItemId, setSelectedItemId] = useState(initialUrlState.selectedItemId);
  const [itemSelectorRequest, setItemSelectorRequest] = useState(0);
  const [filters, setFilters] = useState<FilterState>(initialUrlState.filters);
  const [focusedLayoutId, setFocusedLayoutId] = useState(initialUrlState.focusedLayoutId);
  const [layouts, setLayouts] = useState<RecipeLayout[]>(initialUrlState.layouts);
  const [installedRecipes, setInstalledRecipes] = useState<InstalledLayoutRecipe[]>(
    initialUrlState.installedRecipes,
  );
  const [viewedInstalledRecipeId, setViewedInstalledRecipeId] = useState<string | null>(
    null,
  );
  const [graphLayoutId, setGraphLayoutId] = useState<string | null>(
    initialUrlState.graphLayoutId,
  );
  const [graphHistories, setGraphHistories] = useState<
    Record<string, GraphLayoutHistory | undefined>
  >({});
  const graphHistoryCaptureRef = useRef<Set<string>>(new Set());
  const recipeData = useMemo(
    () => createRecipeExplorerDataWithInstalled(explorerData, installedRecipes),
    [installedRecipes],
  );
  const selectedItem = selectedItemId
    ? recipeData.itemById.get(selectedItemId) ?? null
    : null;
  const focusedLayout = layouts.find((layout) => layout.id === focusedLayoutId) ?? layouts[0];
  const viewedInstalledRecipe = viewedInstalledRecipeId
    ? installedRecipes.find((recipe) => recipe.id === viewedInstalledRecipeId) ?? null
    : null;
  const graphInstalledRecipe = activeView === "graph" ? viewedInstalledRecipe : null;
  const graphLayout =
    graphInstalledRecipe?.layout ??
    (graphLayoutId ? layouts.find((layout) => layout.id === graphLayoutId) : null) ??
    (activeView === "graph" ? focusedLayout ?? null : null);
  const graphHistory =
    graphLayout && !graphInstalledRecipe ? graphHistories[graphLayout.id] : undefined;

  if (!explorerData.items.length) {
    throw new Error("FactorioLab data did not include any items");
  }

  const madeBy = useMemo(
    () =>
      selectedItem
        ? filterRecipes(recipeData.madeBy(selectedItem.id), filters, {
            direction: "made-by",
            selectedItemId: selectedItem.id,
          })
        : [],
    [filters, recipeData, selectedItem],
  );
  const usedIn = useMemo(
    () =>
      selectedItem
        ? filterRecipes(recipeData.usedIn(selectedItem.id), filters, {
            direction: "used-in",
            selectedItemId: selectedItem.id,
          })
        : [],
    [filters, recipeData, selectedItem],
  );
  const selectedIcon = selectedItem
    ? recipeData.iconById.get(getIconIdForItem(selectedItem))
    : undefined;

  useEffect(() => {
    updateUrlFromAppState({
      activeView,
      selectedItemId,
      filters,
      focusedLayoutId,
      graphLayoutId,
      installedRecipes,
      layouts,
    });
  }, [
    activeView,
    filters,
    focusedLayoutId,
    graphLayoutId,
    installedRecipes,
    layouts,
    selectedItemId,
  ]);

  useEffect(() => {
    function handlePopState() {
      const nextState = readAppStateFromUrl();

      setSelectedItemId(nextState.selectedItemId);
      setActiveView(nextState.activeView);
      setFilters(nextState.filters);
      setFocusedLayoutId(nextState.focusedLayoutId);
      setLayouts(nextState.layouts);
      setInstalledRecipes(nextState.installedRecipes);
      setGraphLayoutId(nextState.graphLayoutId);
      setViewedInstalledRecipeId(null);
      setGraphHistories({});
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (
      viewedInstalledRecipeId &&
      !installedRecipes.some((recipe) => recipe.id === viewedInstalledRecipeId)
    ) {
      setViewedInstalledRecipeId(null);
    }
  }, [installedRecipes, viewedInstalledRecipeId]);

  function selectItem(itemId: string) {
    setViewedInstalledRecipeId(null);
    setSelectedItemId(itemId);
    setActiveView("recipes");
  }

  function openItemSelector() {
    setViewedInstalledRecipeId(null);
    setActiveView("recipes");
    setItemSelectorRequest((currentRequest) => currentRequest + 1);
  }

  function createLayout() {
    const layout = createEmptyLayout(createLayoutId());

    setLayouts((currentLayouts) => [...currentLayouts, layout]);
    setFocusedLayoutId(layout.id);
    setViewedInstalledRecipeId(null);
    setActiveView("layouts");
  }

  function renameLayout(layoutId: string, name: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId ? { ...layout, name } : layout,
      ),
    );
  }

  function updateLayoutIconSettings(
    layoutId: string,
    iconIds: string[],
    hiddenIconIds: string[],
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              iconIds: sanitizeLayoutIconIds(iconIds),
              hiddenIconIds: sanitizeLayoutIconIds(hiddenIconIds),
            }
          : layout,
      ),
    );
  }

  function focusLayout(layoutId: string) {
    setFocusedLayoutId(layoutId);
    setViewedInstalledRecipeId(null);

    if (activeView === "graph") {
      setGraphLayoutId(layoutId);
    }
  }

  function openLayoutGraph(layoutId: string) {
    setFocusedLayoutId(layoutId);
    setViewedInstalledRecipeId(null);
    setGraphLayoutId(layoutId);
    setActiveView("graph");
  }

  function openInstalledRecipeGraph(recipeId: string) {
    if (!installedRecipes.some((recipe) => recipe.id === recipeId)) {
      return;
    }

    setViewedInstalledRecipeId(recipeId);
    setGraphLayoutId(null);
    setActiveView("graph");
  }

  function openInstalledRecipe(recipeId: string) {
    if (!installedRecipes.some((recipe) => recipe.id === recipeId)) {
      return;
    }

    setViewedInstalledRecipeId(recipeId);
    setGraphLayoutId(null);
    setActiveView("layouts");
  }

  function changeView(view: AppView) {
    if (view !== "layouts" && view !== "graph") {
      setViewedInstalledRecipeId(null);
    }

    setActiveView(view);
  }

  function addRecipeToFocusedLayout(recipeId: string) {
    const recipe = recipeData.recipeById.get(recipeId);

    if (!focusedLayout || !recipe) {
      return;
    }

    const entry = createLayoutEntry(recipeId);

    clearGraphHistory(focusedLayout.id);
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === focusedLayout.id
          ? {
              ...layout,
              collapsed: false,
              edgeItems: {
                ...layout.edgeItems,
                ...createHiddenEdgeItemsForNewRecipe(
                  layout,
                  entry,
                  recipe,
                  recipeData.recipeById,
                ),
              },
              entries: [...layout.entries, entry],
            }
          : layout,
      ),
    );
  }

  function removeRecipeFromLayout(layoutId: string, entryId: string) {
    clearGraphHistory(layoutId);
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const entries = layout.entries.filter((entry) => entry.id !== entryId);

        if (!entries.length) {
          return {
            ...layout,
            entries,
            relays: [],
            graphPositions: {},
            edgePorts: {},
            edgeRoutes: {},
            edgeItems: {},
            externalItems: {},
            terminalSides: {},
          };
        }

        return {
          ...layout,
          entries,
          graphPositions: omitGraphPosition(layout.graphPositions, entryId),
          edgePorts: omitGraphEdgePorts(layout.edgePorts, entryId),
          edgeRoutes: omitGraphEdgeRoutes(layout.edgeRoutes, entryId),
          edgeItems: omitGraphEdgeItems(layout.edgeItems, entryId),
          externalItems: omitGraphExternalItems(layout.externalItems, entryId),
          terminalSides: omitGraphTerminalSides(layout.terminalSides, entryId),
        };
      }),
    );
  }

  function updateRecipeProductionSize(
    layoutId: string,
    entryId: string,
    productionSize: number,
  ) {
    const nextProductionSize = normalizeProductionSize(productionSize);

    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              entries: layout.entries.map((entry) =>
                entry.id === entryId
                  ? { ...entry, productionSize: nextProductionSize }
                  : entry,
              ),
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

    clearGraphHistory(layoutId);
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

  function reorderLayout(
    sourceLayoutId: string,
    targetLayoutId: string,
    placement: LayoutReorderPlacement,
  ) {
    if (sourceLayoutId === targetLayoutId) {
      return;
    }

    setLayouts((currentLayouts) => {
      const sourceIndex = currentLayouts.findIndex(
        (layout) => layout.id === sourceLayoutId,
      );
      const targetIndex = currentLayouts.findIndex(
        (layout) => layout.id === targetLayoutId,
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentLayouts;
      }

      const nextLayouts = [...currentLayouts];
      const [sourceLayout] = nextLayouts.splice(sourceIndex, 1);
      const shiftedTargetIndex = nextLayouts.findIndex(
        (layout) => layout.id === targetLayoutId,
      );

      if (!sourceLayout || shiftedTargetIndex < 0) {
        return currentLayouts;
      }

      const insertIndex =
        shiftedTargetIndex + (placement === "after" ? 1 : 0);

      nextLayouts.splice(insertIndex, 0, sourceLayout);
      return nextLayouts;
    });
  }

  function deleteLayout(layoutId: string) {
    clearGraphHistory(layoutId);
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
      setGraphLayoutId(nextFocusedLayoutId);
    }
  }

  function installLayout(layoutId: string) {
    const layout = layouts.find((candidate) => candidate.id === layoutId);

    if (!layout || !layout.entries.length) {
      return;
    }

    const installedRecipe: InstalledLayoutRecipe = {
      id: createInstalledRecipeId(installedRecipes),
      layout: cloneRecipeLayout(layout),
      name: layout.name,
    };
    const remainingLayouts = layouts.filter((candidate) => candidate.id !== layoutId);
    const nextLayouts = remainingLayouts.length
      ? remainingLayouts
      : [createEmptyLayout(createLayoutId())];
    const nextFocusedLayoutId = nextLayouts.some((candidate) => candidate.id === focusedLayoutId)
      ? focusedLayoutId
      : nextLayouts[0]?.id ?? defaultLayoutId;

    clearGraphHistory(layoutId);
    setViewedInstalledRecipeId(null);
    setInstalledRecipes((currentInstalledRecipes) => [
      ...currentInstalledRecipes,
      installedRecipe,
    ]);
    setLayouts(nextLayouts);
    setFocusedLayoutId(nextFocusedLayoutId);

    if (graphLayoutId === layoutId) {
      setGraphLayoutId(nextFocusedLayoutId);
      setActiveView("layouts");
    }
  }

  function unloadInstalledRecipe(recipeId: string) {
    if (getInstalledRecipeReferenceCount(recipeId) > 0) {
      return;
    }

    const installedRecipe = installedRecipes.find(
      (candidate) => candidate.id === recipeId,
    );

    if (!installedRecipe) {
      return;
    }

    const restoredLayout = cloneRecipeLayout(
      installedRecipe.layout,
      createUnloadedLayoutId(installedRecipe.layout.id, layouts),
    );

    setInstalledRecipes((currentInstalledRecipes) =>
      currentInstalledRecipes.filter((candidate) => candidate.id !== recipeId),
    );
    setLayouts((currentLayouts) => [...currentLayouts, restoredLayout]);
    setFocusedLayoutId(restoredLayout.id);
    setGraphLayoutId(null);
    setViewedInstalledRecipeId(null);
    setActiveView("layouts");
  }

  function getFocusedLayoutRecipeCount(recipeId: string): number {
    return (
      focusedLayout?.entries.filter((entry) => entry.recipeId === recipeId).length ?? 0
    );
  }

  function getInstalledRecipeReferenceCount(recipeId: string): number {
    return countRecipeReferences(recipeId, layouts, installedRecipes);
  }

  function exportLayout(layoutId: string): string | null {
    const layout = layouts.find((candidate) => candidate.id === layoutId);

    if (!layout) {
      return null;
    }

    return createLayoutExportString(layout, installedRecipes);
  }

  function createLayoutExportString(
    layout: RecipeLayout,
    installedRecipes: readonly InstalledLayoutRecipe[],
  ): string {
    const dependencies = getInstalledRecipeDependencies(layout, installedRecipes);
    const state = serializeLayoutForExport(layout);
    const payload = {
      type: "factorio-facts/layout",
      version: 2,
      exportedAt: new Date().toISOString(),
      state,
      ...(dependencies.length
        ? { dependencies: dependencies.map(serializeInstalledRecipeDependency) }
        : {}),
    };

    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  function importLayout(layoutId: string, value: string): boolean {
    const targetLayout = layouts.find((layout) => layout.id === layoutId);

    if (!targetLayout || targetLayout.entries.length) {
      return false;
    }

    try {
      const importedBundle = parseImportedLayoutBundle(value, installedRecipes);

      if (!importedBundle) {
        return false;
      }

      const resolvedBundle = resolveImportedLayoutBundle(
        importedBundle,
        installedRecipes,
      );

      setInstalledRecipes((currentInstalledRecipes) => [
        ...currentInstalledRecipes,
        ...resolvedBundle.dependencies,
      ]);
      setLayouts((currentLayouts) =>
        currentLayouts.map((layout) =>
          layout.id === layoutId
            ? {
                ...resolvedBundle.layout,
                id: layout.id,
                collapsed: false,
              }
            : layout,
        ),
      );
      setFocusedLayoutId(layoutId);
      setViewedInstalledRecipeId(null);
      clearGraphHistory(layoutId);
      return true;
    } catch {
      return false;
    }
  }

  function importLayoutAsNew(value: string): boolean {
    try {
      const importedBundle = parseImportedLayoutBundle(value, installedRecipes);

      if (!importedBundle) {
        return false;
      }

      const resolvedBundle = resolveImportedLayoutBundle(
        importedBundle,
        installedRecipes,
      );
      const layoutId = createImportedLayoutId(resolvedBundle.layout.id, layouts);
      const importedLayout = cloneRecipeLayout(resolvedBundle.layout, layoutId);

      setInstalledRecipes((currentInstalledRecipes) => [
        ...currentInstalledRecipes,
        ...resolvedBundle.dependencies,
      ]);
      setLayouts((currentLayouts) => [
        ...currentLayouts,
        {
          ...importedLayout,
          collapsed: false,
        },
      ]);
      setFocusedLayoutId(layoutId);
      setGraphLayoutId(null);
      setViewedInstalledRecipeId(null);
      setActiveView("layouts");
      clearGraphHistory(layoutId);
      return true;
    } catch {
      return false;
    }
  }

  function captureGraphHistory(layoutId: string) {
    if (graphHistoryCaptureRef.current.has(layoutId)) {
      return;
    }

    const layout = layouts.find((candidate) => candidate.id === layoutId);

    if (!layout) {
      return;
    }

    graphHistoryCaptureRef.current.add(layoutId);
    window.setTimeout(() => {
      graphHistoryCaptureRef.current.delete(layoutId);
    }, 0);

    const snapshot = createGraphLayoutSnapshot(layout);

    setGraphHistories((currentHistories) => {
      const history = currentHistories[layoutId] ?? { undo: [], redo: [] };

      return {
        ...currentHistories,
        [layoutId]: {
          undo: [...history.undo, snapshot].slice(-graphHistoryLimit),
          redo: [],
        },
      };
    });
  }

  function clearGraphHistory(layoutId: string) {
    setGraphHistories((currentHistories) => {
      if (!currentHistories[layoutId]) {
        return currentHistories;
      }

      const { [layoutId]: _removedHistory, ...remainingHistories } = currentHistories;

      return remainingHistories;
    });
  }

  function undoLayoutGraph(layoutId: string) {
    const layout = layouts.find((candidate) => candidate.id === layoutId);
    const history = graphHistories[layoutId];
    const previousSnapshot = history?.undo[history.undo.length - 1];

    if (!layout || !history || !previousSnapshot) {
      return;
    }

    const currentSnapshot = createGraphLayoutSnapshot(layout);

    setGraphHistories((currentHistories) => {
      const currentHistory = currentHistories[layoutId] ?? { undo: [], redo: [] };

      return {
        ...currentHistories,
        [layoutId]: {
          undo: currentHistory.undo.slice(0, -1),
          redo: [currentSnapshot, ...currentHistory.redo].slice(0, graphHistoryLimit),
        },
      };
    });
    setLayouts((currentLayouts) =>
      currentLayouts.map((currentLayout) =>
        currentLayout.id === layoutId
          ? applyGraphLayoutSnapshot(currentLayout, previousSnapshot)
          : currentLayout,
      ),
    );
  }

  function redoLayoutGraph(layoutId: string) {
    const layout = layouts.find((candidate) => candidate.id === layoutId);
    const history = graphHistories[layoutId];
    const nextSnapshot = history?.redo[0];

    if (!layout || !history || !nextSnapshot) {
      return;
    }

    const currentSnapshot = createGraphLayoutSnapshot(layout);

    setGraphHistories((currentHistories) => {
      const currentHistory = currentHistories[layoutId] ?? { undo: [], redo: [] };

      return {
        ...currentHistories,
        [layoutId]: {
          undo: [...currentHistory.undo, currentSnapshot].slice(-graphHistoryLimit),
          redo: currentHistory.redo.slice(1),
        },
      };
    });
    setLayouts((currentLayouts) =>
      currentLayouts.map((currentLayout) =>
        currentLayout.id === layoutId
          ? applyGraphLayoutSnapshot(currentLayout, nextSnapshot)
          : currentLayout,
      ),
    );
  }

  function updateLayoutGraphNodePosition(
    layoutId: string,
    nodeId: string,
    position: GraphNodePosition,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              graphPositions: {
                ...layout.graphPositions,
                [nodeId]: {
                  x: Math.round(position.x),
                  y: Math.round(position.y),
                },
              },
            }
          : layout,
      ),
    );
  }

  function createLayoutGraphRelay(
    layoutId: string,
    relay: GraphRelay,
    position: GraphNodePosition,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId || !relay.itemKeys.length) {
          return layout;
        }

        const nodeIds = new Set([
          ...layout.entries.map((entry) => entry.id),
          ...layout.relays.map((existingRelay) => existingRelay.id),
        ]);

        if (nodeIds.has(relay.id)) {
          return layout;
        }

        return {
          ...layout,
          relays: [
            ...layout.relays,
            {
              id: relay.id,
              itemKeys: uniqueStrings(relay.itemKeys),
            },
          ],
          graphPositions: {
            ...layout.graphPositions,
            [relay.id]: {
              x: Math.round(position.x),
              y: Math.round(position.y),
            },
          },
        };
      }),
    );
  }

  function deleteLayoutGraphRelay(layoutId: string, relayId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              relays: layout.relays.filter((relay) => relay.id !== relayId),
              graphPositions: omitGraphPosition(layout.graphPositions, relayId),
              edgePorts: omitGraphEdgePorts(layout.edgePorts, relayId),
              edgeRoutes: omitGraphEdgeRoutes(layout.edgeRoutes, relayId),
              edgeItems: omitGraphEdgeItems(layout.edgeItems, relayId),
              externalItems: omitGraphExternalItems(layout.externalItems, relayId),
              terminalSides: omitGraphTerminalSides(layout.terminalSides, relayId),
            }
          : layout,
      ),
    );
  }

  function updateLayoutGraphRelayItems(
    layoutId: string,
    relayId: string,
    itemKeys: string[],
  ) {
    const nextRelayItemKeys = uniqueStrings(itemKeys);

    if (!nextRelayItemKeys.length) {
      return;
    }

    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const relay = layout.relays.find((candidate) => candidate.id === relayId);

        if (!relay) {
          return layout;
        }

        const nextRelayItemKeySet = new Set(nextRelayItemKeys);

        return {
          ...layout,
          relays: layout.relays.map((candidate) =>
            candidate.id === relayId
              ? { ...candidate, itemKeys: nextRelayItemKeys }
              : candidate,
          ),
          edgeItems: pruneRelayEdgeItems(
            layout.edgeItems,
            relayId,
            nextRelayItemKeySet,
          ),
          externalItems: pruneRelayExternalItems(
            layout.externalItems,
            relayId,
            nextRelayItemKeySet,
          ),
        };
      }),
    );
  }

  function updateLayoutGraphEdgePorts(
    layoutId: string,
    edgeId: string,
    ports: GraphEdgePorts,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              edgePorts: {
                ...layout.edgePorts,
                [edgeId]: ports,
              },
            }
          : layout,
      ),
    );
  }

  function updateLayoutGraphEdgeRoute(
    layoutId: string,
    edgeId: string,
    route: GraphEdgeRoute,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              edgeRoutes: {
                ...layout.edgeRoutes,
                [edgeId]: {
                  x: Math.round(route.x),
                  y: Math.round(route.y),
                },
              },
            }
          : layout,
      ),
    );
  }

  function resetLayoutGraphEdgeRoute(layoutId: string, edgeId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const { [edgeId]: _removedRoute, ...edgeRoutes } = layout.edgeRoutes;

        return { ...layout, edgeRoutes };
      }),
    );
  }

  function updateLayoutGraphEdgeItems(
    layoutId: string,
    edgeId: string,
    itemKeys: string[],
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              edgeItems: {
                ...layout.edgeItems,
                [edgeId]: uniqueStrings(itemKeys),
              },
            }
          : layout,
      ),
    );
  }

  function resetLayoutGraphEdgeItems(layoutId: string, edgeId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const { [edgeId]: _removedItems, ...edgeItems } = layout.edgeItems;

        return { ...layout, edgeItems };
      }),
    );
  }

  function updateLayoutGraphExternalItems(
    layoutId: string,
    terminalId: string,
    itemKeys: string[],
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) => {
        if (layout.id !== layoutId) {
          return layout;
        }

        const nextExternalItems = { ...layout.externalItems };
        const uniqueItemKeys = uniqueStrings(itemKeys);

        if (uniqueItemKeys.length) {
          nextExternalItems[terminalId] = uniqueItemKeys;
        } else {
          delete nextExternalItems[terminalId];
        }

        return {
          ...layout,
          externalItems: nextExternalItems,
        };
      }),
    );
  }

  function updateLayoutGraphTerminalSide(
    layoutId: string,
    terminalId: string,
    side: GraphSide,
  ) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              terminalSides: {
                ...layout.terminalSides,
                [terminalId]: side,
              },
            }
          : layout,
      ),
    );
  }

  function resetLayoutGraph(layoutId: string) {
    setLayouts((currentLayouts) =>
      currentLayouts.map((layout) =>
        layout.id === layoutId
          ? {
              ...layout,
              relays: [],
              graphPositions: {},
              edgePorts: {},
              edgeRoutes: {},
              edgeItems: {},
              externalItems: {},
              terminalSides: {},
            }
          : layout,
      ),
    );
  }

  return (
    <main className={`app-shell app-shell--${activeView}`}>
      <AppSidebar
        activeView={activeView}
        data={recipeData}
        focusedLayoutId={focusedLayout?.id ?? defaultLayoutId}
        getInstalledRecipeReferenceCount={getInstalledRecipeReferenceCount}
        installedRecipes={installedRecipes}
        itemSelectorRequest={itemSelectorRequest}
        layouts={layouts}
        onAddInstalledRecipeToLayout={addRecipeToFocusedLayout}
        onCreateLayout={createLayout}
        onFocusLayout={focusLayout}
        onImportLayout={importLayoutAsNew}
        onInstalledRecipeUnload={unloadInstalledRecipe}
        onOpenInstalledRecipe={openInstalledRecipe}
        onOpenInstalledRecipeGraph={openInstalledRecipeGraph}
        onOpenLayoutGraph={openLayoutGraph}
        onReorderLayout={reorderLayout}
        onSelectItem={selectItem}
        onViewChange={changeView}
        selectedItemId={selectedItem?.id ?? null}
        viewedInstalledRecipeId={viewedInstalledRecipeId}
      />

      {activeView === "recipes" ? (
        <>
          <section className={`workspace ${selectedItem ? "" : "workspace--empty"}`}>
            {selectedItem ? (
              <>
                <header className="workspace-header app-panel">
                  <div className="selected-item">
                    <IconSprite
                      atlas={recipeData.atlas}
                      icon={selectedIcon}
                      label={selectedItem.name}
                      size={42}
                    />
                    <div>
                      <h1>{selectedItem.name}</h1>
                      <span>{selectedItem.id}</span>
                    </div>
                  </div>
                </header>

                <div className="recipe-workspace-toolbar">
                  <div className="workspace-stats">
                    <span>
                      <ArrowDownToLine size={16} aria-hidden="true" />
                      {madeBy.length} made by
                    </span>
                    <span>
                      <ArrowUpFromLine size={16} aria-hidden="true" />
                      {usedIn.length} used in
                    </span>
                  </div>
                </div>

                <div className="recipe-grid">
                  <RecipeColumn
                    data={recipeData}
                    getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
                    onAddRecipeToLayout={addRecipeToFocusedLayout}
                    onSelectItem={selectItem}
                    recipes={madeBy}
                    selectedItemId={selectedItem.id}
                    variant="made-by"
                    title="Made by"
                  />
                  <RecipeColumn
                    data={recipeData}
                    getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
                    onAddRecipeToLayout={addRecipeToFocusedLayout}
                    onSelectItem={selectItem}
                    recipes={usedIn}
                    selectedItemId={selectedItem.id}
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

            <DataFootnote />
          </section>

          <FilterPanel
            data={explorerData}
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(defaultFilters)}
          />
        </>
      ) : null}

      {activeView === "layouts" ? (
        <div className="layout-view">
          <LayoutWorkspace
            data={recipeData}
            focusedLayoutId={focusedLayout?.id ?? defaultLayoutId}
            getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
            layoutOverride={viewedInstalledRecipe?.layout ?? null}
            layouts={layouts}
            onAddRecipeToLayout={addRecipeToFocusedLayout}
            onCreateLayout={createLayout}
            onDeleteLayout={deleteLayout}
            onExportLayout={exportLayout}
            onImportLayout={importLayout}
            onInstallLayout={installLayout}
            onOpenItemSelector={openItemSelector}
            onOpenLayoutGraph={
              viewedInstalledRecipe
                ? () => openInstalledRecipeGraph(viewedInstalledRecipe.id)
                : openLayoutGraph
            }
            onRecipeProductionSizeChange={updateRecipeProductionSize}
            onRemoveRecipeFromLayout={removeRecipeFromLayout}
            onLayoutIconSettingsChange={updateLayoutIconSettings}
            onRenameLayout={renameLayout}
            onReorderRecipeInLayout={reorderRecipeInLayout}
            onSelectItem={selectItem}
            readOnly={Boolean(viewedInstalledRecipe)}
            readOnlyLabel="Installed layout"
          />
          <DataFootnote />
        </div>
      ) : null}

      {activeView === "graph" ? (
        <section className="graph-workspace">
          {graphLayout ? (
            <Suspense fallback={<GraphLoadingState />}>
              <LayoutGraphDialog
                canRedoGraph={Boolean(graphHistory?.redo.length)}
                canUndoGraph={Boolean(graphHistory?.undo.length)}
                data={recipeData}
                layout={graphLayout}
                readOnly={Boolean(graphInstalledRecipe)}
                readOnlyLabel="Installed layout"
                variant="workspace"
                onClose={() => setActiveView("layouts")}
                onEdgePortsChange={(edgeId, ports) =>
                  updateLayoutGraphEdgePorts(graphLayout.id, edgeId, ports)
                }
                onEdgeRouteChange={(edgeId, route) =>
                  updateLayoutGraphEdgeRoute(graphLayout.id, edgeId, route)
                }
                onEdgeRouteReset={(edgeId) =>
                  resetLayoutGraphEdgeRoute(graphLayout.id, edgeId)
                }
                onEdgeItemsChange={(edgeId, itemKeys) =>
                  updateLayoutGraphEdgeItems(graphLayout.id, edgeId, itemKeys)
                }
                onEdgeItemsReset={(edgeId) =>
                  resetLayoutGraphEdgeItems(graphLayout.id, edgeId)
                }
                onExternalItemsChange={(terminalId, itemKeys) =>
                  updateLayoutGraphExternalItems(graphLayout.id, terminalId, itemKeys)
                }
                onExportLayout={() =>
                  graphInstalledRecipe
                    ? createLayoutExportString(
                        graphInstalledRecipe.layout,
                        installedRecipes,
                      )
                    : exportLayout(graphLayout.id)
                }
                onRelayCreate={(relay, position) =>
                  createLayoutGraphRelay(graphLayout.id, relay, position)
                }
                onRelayDelete={(relayId) =>
                  deleteLayoutGraphRelay(graphLayout.id, relayId)
                }
                onRelayItemsChange={(relayId, itemKeys) =>
                  updateLayoutGraphRelayItems(graphLayout.id, relayId, itemKeys)
                }
                onGraphEditStart={() => captureGraphHistory(graphLayout.id)}
                onGraphRedo={() => redoLayoutGraph(graphLayout.id)}
                onGraphUndo={() => undoLayoutGraph(graphLayout.id)}
                onNodePositionChange={(entryId, position) =>
                  updateLayoutGraphNodePosition(graphLayout.id, entryId, position)
                }
                onResetGraphPositions={() => resetLayoutGraph(graphLayout.id)}
                onSelectItem={selectItem}
                onTerminalSideChange={(terminalId, side) =>
                  updateLayoutGraphTerminalSide(graphLayout.id, terminalId, side)
                }
              />
            </Suspense>
          ) : (
            <div className="workspace-empty app-panel">
              <Package size={40} aria-hidden="true" />
              <div>
                <h1>No graph</h1>
                <span>No layout selected</span>
              </div>
            </div>
          )}
          <DataFootnote />
        </section>
      ) : null}

      <TooltipLayer />
    </main>
  );
}

function DataFootnote() {
  return (
    <footer className="data-footnote">
      <span className="data-footnote__version">{explorerData.versionLabel}</span>
      <span className="data-footnote__separator">/</span>
      <span className="data-footnote__recipes">
        <Database size={14} aria-hidden="true" />
        {explorerData.recipes.length} recipes
      </span>
    </footer>
  );
}

function GraphLoadingState() {
  return (
    <div className="workspace-empty app-panel">
      <Package size={40} aria-hidden="true" />
      <div>
        <h1>Loading graph</h1>
        <span>Preparing layout graph tools</span>
      </div>
    </div>
  );
}

function readAppStateFromUrl(): AppUrlState {
  const params = new URLSearchParams(window.location.search);
  const selectedItemId = parseItemId(params.get("item"));
  const layoutState = normalizeParsedLayoutState(
    parseCompactLayoutState(params.get("s"), {
      defaultLayoutId,
      isRecipeIdAllowed: (recipeId) => explorerData.recipeById.has(recipeId),
    }) ?? parseLayoutState(params.get("layouts")),
  );
  const activeView = parseAppView(params.get("mode"));
  const graphLayoutId = parseGraphLayoutId(params.get("graph"), layoutState.layouts);

  return {
    activeView,
    selectedItemId,
    filters: {
      locations: parseIdList(params, "surface", (id) => explorerData.locationById.has(id)),
      categories: parseIdList(params, "category", (id) =>
        explorerData.categories.some((category) => category.id === id),
      ),
      madeByNoByproducts: parseBooleanParam(
        params,
        "no-byproducts",
        defaultFilters.madeByNoByproducts,
      ),
      usedInNoCoInputs: parseBooleanParam(
        params,
        "no-co-inputs",
        defaultFilters.usedInNoCoInputs,
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
    graphLayoutId,
    installedRecipes: layoutState.installedRecipes,
    layouts: layoutState.layouts,
  };
}

function updateUrlFromAppState(state: AppUrlState) {
  const params = new URLSearchParams();

  if (state.selectedItemId) {
    params.set("item", state.selectedItemId);
  }

  if (state.activeView !== defaultAppView) {
    params.set("mode", state.activeView);
  }

  if (
    state.activeView === "graph" &&
    state.graphLayoutId &&
    state.graphLayoutId !== state.focusedLayoutId
  ) {
    params.set("graph", state.graphLayoutId);
  }

  setListParam(params, "surface", state.filters.locations);
  setListParam(params, "category", state.filters.categories);
  setBooleanParam(
    params,
    "no-byproducts",
    state.filters.madeByNoByproducts,
    defaultFilters.madeByNoByproducts,
  );
  setBooleanParam(
    params,
    "no-co-inputs",
    state.filters.usedInNoCoInputs,
    defaultFilters.usedInNoCoInputs,
  );
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

  if (
    !isDefaultLayoutState(
      state.layouts,
      state.focusedLayoutId,
      state.installedRecipes,
    )
  ) {
    params.set(
      "s",
      serializeCompactLayoutState(
        state.layouts,
        state.focusedLayoutId,
        state.installedRecipes,
      ),
    );
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
  installedRecipes: InstalledLayoutRecipe[];
  layouts: RecipeLayout[];
}

interface ParsedImportedLayoutBundle {
  dependencies: InstalledLayoutRecipe[];
  layout: RecipeLayout;
}

interface ParseLayoutStateOptions {
  allowedRecipeIds?: ReadonlySet<string>;
}

function normalizeParsedLayoutState(state: ParsedLayoutState): ParsedLayoutState {
  return {
    ...state,
    installedRecipes: state.installedRecipes.map((installedRecipe) => ({
      ...installedRecipe,
      layout: sanitizeRecipeLayout(installedRecipe.layout),
    })),
    layouts: state.layouts.map(sanitizeRecipeLayout),
  };
}

function sanitizeRecipeLayout(layout: RecipeLayout): RecipeLayout {
  return {
    ...layout,
    iconIds: sanitizeLayoutIconIds(layout.iconIds),
    hiddenIconIds: sanitizeLayoutIconIds(layout.hiddenIconIds),
    entries: layout.entries.map(normalizeRecipeLayoutEntry),
  };
}

function normalizeRecipeLayoutEntry(entry: RecipeLayoutEntry): RecipeLayoutEntry {
  return {
    id: entry.id,
    productionSize: normalizeProductionSize(entry.productionSize),
    recipeId: entry.recipeId,
  };
}

interface SerializedLayoutState {
  f?: unknown;
  l?: unknown;
}

interface SerializedLayoutExportDependency {
  id?: unknown;
  name?: unknown;
  state?: unknown;
}

interface SerializedLayout {
  c?: unknown;
  e?: unknown;
  h?: unknown;
  i?: unknown;
  m?: unknown;
  n?: unknown;
  o?: unknown;
  p?: unknown;
  r?: unknown;
  t?: unknown;
  v?: unknown;
  x?: unknown;
  y?: unknown;
}

interface SerializedLayoutEntry {
  b?: unknown;
  i?: unknown;
  m?: unknown;
  u?: unknown;
  r?: unknown;
  s?: unknown;
}

interface SerializedGraphRelay {
  i?: unknown;
  k?: unknown;
}

function parseLayoutState(
  value: string | null,
  options: ParseLayoutStateOptions = {},
): ParsedLayoutState {
  if (!value) {
    const layout = createEmptyLayout(defaultLayoutId);

    return { focusedLayoutId: layout.id, installedRecipes: [], layouts: [layout] };
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
          parseLayout(rawLayout, index, seenLayoutIds, options),
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

    return { focusedLayoutId, installedRecipes: [], layouts };
  } catch {
    return defaultLayoutState();
  }
}

function parseImportedLayoutBundle(
  value: string,
  installedRecipes: readonly InstalledLayoutRecipe[],
): ParsedImportedLayoutBundle | null {
  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed)) {
    return null;
  }

  let state: unknown = parsed;
  let rawDependencies: unknown = [];

  if (parsed.type === "factorio-facts/layout" && isRecord(parsed.state)) {
    state = parsed.state;
    rawDependencies = parsed.dependencies;
  } else if (!Array.isArray(parsed.l) && isRecord(parsed.layout)) {
    state = { l: [parsed.layout] };
  }

  if (!isRecord(state) || !Array.isArray(state.l)) {
    return null;
  }

  const dependencyIds = parseImportedDependencyIds(rawDependencies);
  const allowedRecipeIds = new Set([
    ...dependencyIds,
    ...installedRecipes.map((installedRecipe) => installedRecipe.id),
  ]);
  const dependencies = parseImportedDependencies(rawDependencies, allowedRecipeIds);
  const importedState = normalizeParsedLayoutState(
    parseLayoutState(JSON.stringify(state), { allowedRecipeIds }),
  );
  const importedLayout = importedState.layouts[0] ?? null;

  return importedLayout && importedLayout.entries.length
    ? { dependencies, layout: importedLayout }
    : null;
}

function parseImportedDependencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenRecipeIds = new Set<string>();
  const recipeIds: string[] = [];

  for (const rawDependency of value) {
    if (!isRecord(rawDependency)) {
      continue;
    }

    const { id } = rawDependency as SerializedLayoutExportDependency;

    if (
      typeof id !== "string" ||
      !isCompositeRecipeId(id) ||
      seenRecipeIds.has(id)
    ) {
      continue;
    }

    seenRecipeIds.add(id);
    recipeIds.push(id);
  }

  return recipeIds;
}

function parseImportedDependencies(
  value: unknown,
  allowedRecipeIds: ReadonlySet<string>,
): InstalledLayoutRecipe[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenRecipeIds = new Set<string>();
  const dependencies: InstalledLayoutRecipe[] = [];

  for (const rawDependency of value) {
    if (!isRecord(rawDependency)) {
      continue;
    }

    const { id, name, state } = rawDependency as SerializedLayoutExportDependency;

    if (
      typeof id !== "string" ||
      !isCompositeRecipeId(id) ||
      seenRecipeIds.has(id) ||
      !isRecord(state)
    ) {
      continue;
    }

    const parsedState = normalizeParsedLayoutState(
      parseLayoutState(JSON.stringify(state), { allowedRecipeIds }),
    );
    const layout = parsedState.layouts[0] ?? null;

    if (!layout || !layout.entries.length) {
      continue;
    }

    seenRecipeIds.add(id);
    dependencies.push({
      id,
      layout,
      name: typeof name === "string" ? name : layout.name,
    });
  }

  return dependencies;
}

function parseLayout(
  rawLayout: unknown,
  index: number,
  seenLayoutIds: Set<string>,
  options: ParseLayoutStateOptions = {},
): RecipeLayout[] {
  if (!isRecord(rawLayout)) {
    return [];
  }

  const {
    c: rawCollapsed,
    e: rawEntries,
    h: rawEdgePorts,
    i: rawId,
    m: rawEdgeItems,
    n: rawName,
    o: rawIconIds,
    p: rawGraphPositions,
    r: rawEdgeRoutes,
    t: rawTerminalSides,
    v: rawHiddenIconIds,
    x: rawExternalItems,
    y: rawRelays,
  } = rawLayout as SerializedLayout;
  const id = getUniqueId(
    typeof rawId === "string" && rawId ? rawId : `layout-${index + 1}`,
    seenLayoutIds,
  );
  const seenEntryIds = new Set<string>();
  const entries = Array.isArray(rawEntries)
    ? rawEntries.flatMap((rawEntry, entryIndex) =>
        parseLayoutEntry(rawEntry, entryIndex, seenEntryIds, options),
      )
    : [];
  const seenNodeIds = new Set(entries.map((entry) => entry.id));
  const relays = Array.isArray(rawRelays)
    ? rawRelays.flatMap((rawRelay, relayIndex) =>
        parseGraphRelay(rawRelay, relayIndex, seenNodeIds),
      )
    : [];
  const nodeIds = new Set([
    ...entries.map((entry) => entry.id),
    ...relays.map((relay) => relay.id),
  ]);

  return [
    {
      id,
      name: typeof rawName === "string" ? rawName : "",
      iconIds: sanitizeLayoutIconIds(parseOrderedStringList(rawIconIds)),
      hiddenIconIds: sanitizeLayoutIconIds(parseOrderedStringList(rawHiddenIconIds)),
      entries,
      relays,
      graphPositions: parseGraphPositions(rawGraphPositions, nodeIds),
      edgePorts: parseGraphEdgePorts(rawEdgePorts, nodeIds),
      edgeRoutes: parseGraphEdgeRoutes(rawEdgeRoutes, nodeIds),
      edgeItems: parseGraphEdgeItemKeys(rawEdgeItems, nodeIds),
      externalItems: parseGraphExternalItemKeys(rawExternalItems, nodeIds),
      terminalSides: parseGraphTerminalSides(rawTerminalSides, nodeIds),
      collapsed: rawCollapsed === 1 || rawCollapsed === true,
    },
  ];
}

function parseGraphPositions(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, GraphNodePosition> {
  if (!isRecord(value)) {
    return {};
  }

  const graphPositions: Record<string, GraphNodePosition> = {};

  for (const [nodeId, rawPosition] of Object.entries(value)) {
    if (!nodeIds.has(nodeId) || !Array.isArray(rawPosition)) {
      continue;
    }

    const [rawX, rawY] = rawPosition;

    if (typeof rawX !== "number" || typeof rawY !== "number") {
      continue;
    }

    graphPositions[nodeId] = {
      x: Math.round(rawX),
      y: Math.round(rawY),
    };
  }

  return graphPositions;
}

function parseGraphEdgePorts(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, GraphEdgePorts> {
  if (!isRecord(value)) {
    return {};
  }

  const edgePorts: Record<string, GraphEdgePorts> = {};

  for (const [edgeId, rawPorts] of Object.entries(value)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    const ports = parseGraphEdgePortValue(rawPorts);

    if (ports) {
      edgePorts[edgeId] = ports;
    }
  }

  return edgePorts;
}

function parseGraphEdgeRoutes(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, GraphEdgeRoute> {
  if (!isRecord(value)) {
    return {};
  }

  const edgeRoutes: Record<string, GraphEdgeRoute> = {};

  for (const [edgeId, rawRoute] of Object.entries(value)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    const route = parseGraphPoint(rawRoute);

    if (route) {
      edgeRoutes[edgeId] = route;
    }
  }

  return edgeRoutes;
}

function parseGraphTerminalSides(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, GraphSide> {
  if (!isRecord(value)) {
    return {};
  }

  const terminalSides: Record<string, GraphSide> = {};

  for (const [terminalId, rawSide] of Object.entries(value)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (
      !terminalEntry ||
      !nodeIds.has(terminalEntry.entryId) ||
      !isGraphSide(rawSide)
    ) {
      continue;
    }

    terminalSides[terminalId] = rawSide;
  }

  return terminalSides;
}

function parseGraphEdgeItemKeys(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, string[]> {
  if (!isRecord(value)) {
    return {};
  }

  const edgeItems: Record<string, string[]> = {};

  for (const [edgeId, rawItemKeys] of Object.entries(value)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    edgeItems[edgeId] = parseStringList(rawItemKeys);
  }

  return edgeItems;
}

function parseGraphExternalItemKeys(
  value: unknown,
  nodeIds: Set<string>,
): Record<string, string[]> {
  if (!isRecord(value)) {
    return {};
  }

  const externalItems: Record<string, string[]> = {};

  for (const [terminalId, rawItemKeys] of Object.entries(value)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (!terminalEntry || !nodeIds.has(terminalEntry.entryId)) {
      continue;
    }

    const itemKeys = parseStringList(rawItemKeys);

    if (itemKeys.length) {
      externalItems[terminalId] = itemKeys;
    }
  }

  return externalItems;
}

function parseGraphPoint(value: unknown): GraphEdgeRoute | null {
  let rawX: unknown;
  let rawY: unknown;

  if (Array.isArray(value)) {
    rawX = value[0];
    rawY = value[1];
  } else if (isRecord(value)) {
    rawX = value.x;
    rawY = value.y;
  }

  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return null;
  }

  return {
    x: Math.round(rawX),
    y: Math.round(rawY),
  };
}

function parseGraphEdgePortValue(value: unknown): GraphEdgePorts | null {
  let rawSourceSide: unknown;
  let rawTargetSide: unknown;

  if (Array.isArray(value)) {
    rawSourceSide = value[0];
    rawTargetSide = value[1];
  } else if (isRecord(value)) {
    rawSourceSide = value.sourceSide;
    rawTargetSide = value.targetSide;
  }

  if (!isGraphSide(rawSourceSide) || !isGraphSide(rawTargetSide)) {
    return null;
  }

  return {
    sourceSide: rawSourceSide,
    targetSide: rawTargetSide,
  };
}

function parseLayoutEntry(
  rawEntry: unknown,
  index: number,
  seenEntryIds: Set<string>,
  options: ParseLayoutStateOptions = {},
): RecipeLayoutEntry[] {
  let rawId: unknown;
  let rawProductionSize: unknown;
  let rawRecipeId: unknown;

  if (Array.isArray(rawEntry)) {
    rawId = rawEntry[0];
    rawRecipeId = rawEntry[1];
    rawProductionSize = rawEntry[2];
  } else if (isRecord(rawEntry)) {
    const entry = rawEntry as SerializedLayoutEntry;

    rawId = entry.i;
    rawRecipeId = entry.r;
    rawProductionSize = entry.s;
  }

  if (
    typeof rawRecipeId !== "string" ||
    (!explorerData.recipeById.has(rawRecipeId) &&
      !options.allowedRecipeIds?.has(rawRecipeId))
  ) {
    return [];
  }

  const entry = normalizeRecipeLayoutEntry({
    id: getUniqueId(
      typeof rawId === "string" && rawId ? rawId : `entry-${index + 1}`,
      seenEntryIds,
    ),
    productionSize: parseProductionSize(rawProductionSize),
    recipeId: rawRecipeId,
  });

  return [entry];
}

function parseProductionSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? normalizeProductionSize(value)
    : defaultProductionSize;
}

function parseGraphRelay(
  rawRelay: unknown,
  index: number,
  seenNodeIds: Set<string>,
): GraphRelay[] {
  let rawId: unknown;
  let rawItemKeys: unknown;

  if (Array.isArray(rawRelay)) {
    rawId = rawRelay[0];
    rawItemKeys = rawRelay[1];
  } else if (isRecord(rawRelay)) {
    const relay = rawRelay as SerializedGraphRelay;

    rawId = relay.i;
    rawItemKeys = relay.k;
  }

  const itemKeys = parseStringList(rawItemKeys);

  if (!itemKeys.length) {
    return [];
  }

  return [
    {
      id: getUniqueId(
        typeof rawId === "string" && rawId ? rawId : `relay-${index + 1}`,
        seenNodeIds,
      ),
      itemKeys,
    },
  ];
}

function serializeLayoutState(layouts: RecipeLayout[], focusedLayoutId: string): string {
  return JSON.stringify({
    f: focusedLayoutId,
    l: layouts.map((layout) => ({
      i: layout.id,
      n: layout.name,
      o: layout.iconIds.length ? layout.iconIds : undefined,
      v: layout.hiddenIconIds.length ? layout.hiddenIconIds : undefined,
      c: layout.collapsed ? 1 : 0,
      e: layout.entries.map(serializeLayoutEntry),
      y: serializeGraphRelays(layout),
      h: serializeGraphEdgePorts(layout),
      m: serializeGraphEdgeItems(layout),
      p: serializeGraphPositions(layout),
      r: serializeGraphEdgeRoutes(layout),
      t: serializeGraphTerminalSides(layout),
      x: serializeGraphExternalItems(layout),
    })),
  });
}

function serializeLayoutForExport(layout: RecipeLayout): unknown {
  return JSON.parse(serializeLayoutState([layout], layout.id)) as unknown;
}

function serializeInstalledRecipeDependency(
  installedRecipe: InstalledLayoutRecipe,
): {
  id: string;
  name: string;
  state: unknown;
} {
  return {
    id: installedRecipe.id,
    name: installedRecipe.name,
    state: serializeLayoutForExport(installedRecipe.layout),
  };
}

function getInstalledRecipeDependencies(
  layout: RecipeLayout,
  installedRecipes: readonly InstalledLayoutRecipe[],
): InstalledLayoutRecipe[] {
  const installedRecipeById = new Map(
    installedRecipes.map((installedRecipe) => [installedRecipe.id, installedRecipe]),
  );
  const dependencies: InstalledLayoutRecipe[] = [];
  const visitedRecipeIds = new Set<string>();

  function visitLayout(candidate: RecipeLayout) {
    for (const entry of candidate.entries) {
      visitRecipe(entry.recipeId);
    }
  }

  function visitRecipe(recipeId: string) {
    if (!isCompositeRecipeId(recipeId) || visitedRecipeIds.has(recipeId)) {
      return;
    }

    const installedRecipe = installedRecipeById.get(recipeId);

    if (!installedRecipe) {
      return;
    }

    visitedRecipeIds.add(recipeId);
    visitLayout(installedRecipe.layout);
    dependencies.push(installedRecipe);
  }

  visitLayout(layout);

  return dependencies;
}

function resolveImportedLayoutBundle(
  bundle: ParsedImportedLayoutBundle,
  installedRecipes: readonly InstalledLayoutRecipe[],
): ParsedImportedLayoutBundle {
  const installedRecipeById = new Map(
    installedRecipes.map((installedRecipe) => [installedRecipe.id, installedRecipe]),
  );
  const claimedRecipeIds = new Set(installedRecipeById.keys());
  const recipeIdMap = new Map<string, string>();
  const dependencyActions: Array<{
    dependency: InstalledLayoutRecipe;
    id: string;
    shouldInstall: boolean;
  }> = [];

  for (const dependency of bundle.dependencies) {
    const remappedDependency: InstalledLayoutRecipe = {
      ...dependency,
      layout: remapRecipeLayoutRecipeIds(dependency.layout, recipeIdMap),
    };
    const existingRecipe = installedRecipeById.get(dependency.id);

    if (existingRecipe && areInstalledRecipesEquivalent(existingRecipe, remappedDependency)) {
      recipeIdMap.set(dependency.id, dependency.id);
      dependencyActions.push({
        dependency,
        id: dependency.id,
        shouldInstall: false,
      });
      continue;
    }

    const id = claimedRecipeIds.has(dependency.id)
      ? createUniqueInstalledRecipeId(claimedRecipeIds)
      : dependency.id;

    claimedRecipeIds.add(id);
    recipeIdMap.set(dependency.id, id);
    dependencyActions.push({
      dependency,
      id,
      shouldInstall: true,
    });
  }

  return {
    dependencies: dependencyActions
      .filter((action) => action.shouldInstall)
      .map((action) => ({
        id: action.id,
        name: action.dependency.name,
        layout: remapRecipeLayoutRecipeIds(action.dependency.layout, recipeIdMap),
      })),
    layout: remapRecipeLayoutRecipeIds(bundle.layout, recipeIdMap),
  };
}

function areInstalledRecipesEquivalent(
  left: InstalledLayoutRecipe,
  right: InstalledLayoutRecipe,
): boolean {
  return (
    left.name === right.name &&
    JSON.stringify(serializeLayoutForExport(left.layout)) ===
      JSON.stringify(serializeLayoutForExport(right.layout))
  );
}

function remapRecipeLayoutRecipeIds(
  layout: RecipeLayout,
  recipeIdMap: ReadonlyMap<string, string>,
): RecipeLayout {
  const clonedLayout = cloneRecipeLayout(layout);

  if (!recipeIdMap.size) {
    return clonedLayout;
  }

  return {
    ...clonedLayout,
    entries: clonedLayout.entries.map((entry) => {
      const recipeId = recipeIdMap.get(entry.recipeId);

      return recipeId ? { ...entry, recipeId } : entry;
    }),
  };
}

function serializeGraphRelays(layout: RecipeLayout): Array<[string, string[]]> | undefined {
  const relays = layout.relays
    .map((relay) => [relay.id, uniqueStrings(relay.itemKeys)] as [string, string[]])
    .filter(([, itemKeys]) => itemKeys.length);

  return relays.length ? relays : undefined;
}

function serializeGraphPositions(
  layout: RecipeLayout,
): Record<string, [number, number]> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const graphPositions: Record<string, [number, number]> = {};

  for (const [nodeId, position] of Object.entries(layout.graphPositions)) {
    if (!nodeIds.has(nodeId)) {
      continue;
    }

    graphPositions[nodeId] = [Math.round(position.x), Math.round(position.y)];
  }

  return Object.keys(graphPositions).length ? graphPositions : undefined;
}

function serializeGraphEdgePorts(
  layout: RecipeLayout,
): Record<string, [GraphSide, GraphSide]> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const edgePorts: Record<string, [GraphSide, GraphSide]> = {};

  for (const [edgeId, ports] of Object.entries(layout.edgePorts)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    edgePorts[edgeId] = [ports.sourceSide, ports.targetSide];
  }

  return Object.keys(edgePorts).length ? edgePorts : undefined;
}

function serializeGraphEdgeRoutes(
  layout: RecipeLayout,
): Record<string, [number, number]> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const edgeRoutes: Record<string, [number, number]> = {};

  for (const [edgeId, route] of Object.entries(layout.edgeRoutes)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    edgeRoutes[edgeId] = [Math.round(route.x), Math.round(route.y)];
  }

  return Object.keys(edgeRoutes).length ? edgeRoutes : undefined;
}

function serializeGraphTerminalSides(
  layout: RecipeLayout,
): Record<string, GraphSide> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const terminalSides: Record<string, GraphSide> = {};

  for (const [terminalId, side] of Object.entries(layout.terminalSides)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (
      !terminalEntry ||
      !nodeIds.has(terminalEntry.entryId) ||
      !isGraphSide(side)
    ) {
      continue;
    }

    terminalSides[terminalId] = side;
  }

  return Object.keys(terminalSides).length ? terminalSides : undefined;
}

function serializeGraphEdgeItems(
  layout: RecipeLayout,
): Record<string, string[]> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const edgeItems: Record<string, string[]> = {};

  for (const [edgeId, itemKeys] of Object.entries(layout.edgeItems)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      !nodeIds.has(edgeEntryIds.sourceId) ||
      !nodeIds.has(edgeEntryIds.targetId)
    ) {
      continue;
    }

    edgeItems[edgeId] = uniqueStrings(itemKeys);
  }

  return Object.keys(edgeItems).length ? edgeItems : undefined;
}

function serializeGraphExternalItems(
  layout: RecipeLayout,
): Record<string, string[]> | undefined {
  const nodeIds = getLayoutGraphNodeIds(layout);
  const externalItems: Record<string, string[]> = {};

  for (const [terminalId, itemKeys] of Object.entries(layout.externalItems)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (!terminalEntry || !nodeIds.has(terminalEntry.entryId)) {
      continue;
    }

    const uniqueItemKeys = uniqueStrings(itemKeys);

    if (uniqueItemKeys.length) {
      externalItems[terminalId] = uniqueItemKeys;
    }
  }

  return Object.keys(externalItems).length ? externalItems : undefined;
}

function getLayoutGraphNodeIds(layout: RecipeLayout): Set<string> {
  return new Set([
    ...layout.entries.map((entry) => entry.id),
    ...layout.relays.map((relay) => relay.id),
  ]);
}

function isDefaultLayoutState(
  layouts: RecipeLayout[],
  focusedLayoutId: string,
  installedRecipes: InstalledLayoutRecipe[],
): boolean {
  const layout = layouts[0];

  return (
    installedRecipes.length === 0 &&
    layouts.length === 1 &&
    focusedLayoutId === defaultLayoutId &&
    layout?.id === defaultLayoutId &&
    layout.name === "" &&
    !layout.collapsed &&
    layout.entries.length === 0 &&
    layout.iconIds.length === 0 &&
    layout.hiddenIconIds.length === 0 &&
    layout.relays.length === 0 &&
    Object.keys(layout.graphPositions).length === 0 &&
    Object.keys(layout.edgePorts).length === 0 &&
    Object.keys(layout.edgeRoutes).length === 0 &&
    Object.keys(layout.edgeItems).length === 0 &&
    Object.keys(layout.externalItems).length === 0 &&
    Object.keys(layout.terminalSides).length === 0
  );
}

function defaultLayoutState(): ParsedLayoutState {
  const layout = createEmptyLayout(defaultLayoutId);

  return { focusedLayoutId: layout.id, installedRecipes: [], layouts: [layout] };
}

function createEmptyLayout(id: string): RecipeLayout {
  return {
    id,
    name: "",
    iconIds: [],
    hiddenIconIds: [],
    entries: [],
    relays: [],
    graphPositions: {},
    edgePorts: {},
    edgeRoutes: {},
    edgeItems: {},
    externalItems: {},
    terminalSides: {},
    collapsed: false,
  };
}

function createLayoutEntry(recipeId: string): RecipeLayoutEntry {
  return {
    id: createLayoutEntryId(),
    productionSize: defaultProductionSize,
    recipeId,
  };
}

function createHiddenEdgeItemsForNewRecipe(
  layout: RecipeLayout,
  entry: RecipeLayoutEntry,
  recipe: RecipePrototype,
  recipeById: ReadonlyMap<string, RecipePrototype>,
): Record<string, string[]> {
  const newNode = createRecipeGraphConnectionNode(entry.id, recipe);
  const existingNodes = getLayoutGraphConnectionNodes(layout, recipeById);
  const hiddenEdgeItems: Record<string, string[]> = {};

  for (const connection of [
    ...getCompatibleGraphConnections([newNode], existingNodes),
    ...getCompatibleGraphConnections(existingNodes, [newNode]),
  ]) {
    hiddenEdgeItems[connection.id] = [];
  }

  return hiddenEdgeItems;
}

function getLayoutGraphConnectionNodes(
  layout: RecipeLayout,
  recipeById: ReadonlyMap<string, RecipePrototype>,
): GraphConnectionNode[] {
  return [
    ...layout.entries.flatMap((entry) => {
      const recipe = recipeById.get(entry.recipeId);

      return recipe ? [createRecipeGraphConnectionNode(entry.id, recipe)] : [];
    }),
    ...layout.relays.flatMap(createRelayGraphConnectionNode),
  ];
}

function createRecipeGraphConnectionNode(
  entryId: string,
  recipe: RecipePrototype,
): GraphConnectionNode {
  return {
    id: entryId,
    ingredients: recipe.ingredients ?? [],
    label: getRecipeMetadata(recipe).name,
    results: recipe.results ?? [],
  };
}

function createRelayGraphConnectionNode(relay: GraphRelay): GraphConnectionNode[] {
  const results = uniqueProducts(
    relay.itemKeys.flatMap((itemKey) => productFromEntityKey(itemKey) ?? []),
  );

  return results.length
    ? [
        {
          id: relay.id,
          ingredients: results.map(productToIngredient),
          label: "Relay",
          results,
        },
      ]
    : [];
}

function serializeLayoutEntry(entry: RecipeLayoutEntry): unknown[] {
  const productionSize = normalizeProductionSize(entry.productionSize);

  if (isDefaultProductionSize(productionSize)) {
    return [entry.id, entry.recipeId];
  }

  return [entry.id, entry.recipeId, productionSize];
}

function createLayoutId(): string {
  return `layout-${Date.now().toString(36)}-${nextLayoutSequence++}`;
}

function createLayoutEntryId(): string {
  return `entry-${Date.now().toString(36)}-${nextLayoutEntrySequence++}`;
}

function createInstalledRecipeId(
  installedRecipes: readonly InstalledLayoutRecipe[],
): string {
  return createUniqueInstalledRecipeId(
    new Set(installedRecipes.map((recipe) => recipe.id)),
  );
}

function createUniqueInstalledRecipeId(existingRecipeIds: ReadonlySet<string>): string {
  let recipeId = `${compositeRecipeIdPrefix}${Date.now().toString(36)}-${nextInstalledRecipeSequence++}`;

  while (existingRecipeIds.has(recipeId)) {
    recipeId = `${compositeRecipeIdPrefix}${Date.now().toString(36)}-${nextInstalledRecipeSequence++}`;
  }

  return recipeId;
}

function createImportedLayoutId(
  preferredLayoutId: string,
  layouts: readonly RecipeLayout[],
): string {
  return preferredLayoutId && !layouts.some((layout) => layout.id === preferredLayoutId)
    ? preferredLayoutId
    : createLayoutId();
}

function createUnloadedLayoutId(
  preferredLayoutId: string,
  layouts: readonly RecipeLayout[],
): string {
  return layouts.some((layout) => layout.id === preferredLayoutId)
    ? createLayoutId()
    : preferredLayoutId;
}

function countRecipeReferences(
  recipeId: string,
  layouts: readonly RecipeLayout[],
  installedRecipes: readonly InstalledLayoutRecipe[],
): number {
  return [
    ...layouts,
    ...installedRecipes.map((installedRecipe) => installedRecipe.layout),
  ].reduce(
    (count, layout) =>
      count + layout.entries.filter((entry) => entry.recipeId === recipeId).length,
    0,
  );
}

function cloneRecipeLayout(layout: RecipeLayout, layoutId = layout.id): RecipeLayout {
  return {
    ...layout,
    id: layoutId,
    iconIds: [...layout.iconIds],
    hiddenIconIds: [...layout.hiddenIconIds],
    entries: layout.entries.map(normalizeRecipeLayoutEntry),
    relays: layout.relays.map((relay) => ({
      ...relay,
      itemKeys: [...relay.itemKeys],
    })),
    graphPositions: cloneGraphPositions(layout.graphPositions),
    edgePorts: cloneGraphEdgePorts(layout.edgePorts),
    edgeRoutes: cloneGraphEdgeRoutes(layout.edgeRoutes),
    edgeItems: cloneStringListRecord(layout.edgeItems),
    externalItems: cloneStringListRecord(layout.externalItems),
    terminalSides: { ...layout.terminalSides },
  };
}

function createGraphLayoutSnapshot(layout: RecipeLayout): GraphLayoutSnapshot {
  return {
    relays: layout.relays.map((relay) => ({
      ...relay,
      itemKeys: [...relay.itemKeys],
    })),
    graphPositions: cloneGraphPositions(layout.graphPositions),
    edgePorts: cloneGraphEdgePorts(layout.edgePorts),
    edgeRoutes: cloneGraphEdgeRoutes(layout.edgeRoutes),
    edgeItems: cloneStringListRecord(layout.edgeItems),
    externalItems: cloneStringListRecord(layout.externalItems),
    terminalSides: { ...layout.terminalSides },
  };
}

function applyGraphLayoutSnapshot(
  layout: RecipeLayout,
  snapshot: GraphLayoutSnapshot,
): RecipeLayout {
  return {
    ...layout,
    relays: snapshot.relays.map((relay) => ({
      ...relay,
      itemKeys: [...relay.itemKeys],
    })),
    graphPositions: cloneGraphPositions(snapshot.graphPositions),
    edgePorts: cloneGraphEdgePorts(snapshot.edgePorts),
    edgeRoutes: cloneGraphEdgeRoutes(snapshot.edgeRoutes),
    edgeItems: cloneStringListRecord(snapshot.edgeItems),
    externalItems: cloneStringListRecord(snapshot.externalItems),
    terminalSides: { ...snapshot.terminalSides },
  };
}

function cloneGraphPositions(
  graphPositions: Record<string, GraphNodePosition>,
): Record<string, GraphNodePosition> {
  return Object.fromEntries(
    Object.entries(graphPositions).map(([nodeId, position]) => [
      nodeId,
      { ...position },
    ]),
  );
}

function cloneGraphEdgePorts(
  edgePorts: Record<string, GraphEdgePorts>,
): Record<string, GraphEdgePorts> {
  return Object.fromEntries(
    Object.entries(edgePorts).map(([edgeId, ports]) => [edgeId, { ...ports }]),
  );
}

function cloneGraphEdgeRoutes(
  edgeRoutes: Record<string, GraphEdgeRoute>,
): Record<string, GraphEdgeRoute> {
  return Object.fromEntries(
    Object.entries(edgeRoutes).map(([edgeId, route]) => [edgeId, { ...route }]),
  );
}

function cloneStringListRecord(
  values: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(values).map(([key, itemKeys]) => [key, [...itemKeys]]),
  );
}

function omitGraphPosition(
  graphPositions: Record<string, GraphNodePosition>,
  entryId: string,
): Record<string, GraphNodePosition> {
  const { [entryId]: _removedPosition, ...remainingPositions } = graphPositions;

  return remainingPositions;
}

function omitGraphEdgePorts(
  edgePorts: Record<string, GraphEdgePorts>,
  entryId: string,
): Record<string, GraphEdgePorts> {
  const remainingPorts: Record<string, GraphEdgePorts> = {};

  for (const [edgeId, ports] of Object.entries(edgePorts)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      edgeEntryIds &&
      edgeEntryIds.sourceId !== entryId &&
      edgeEntryIds.targetId !== entryId
    ) {
      remainingPorts[edgeId] = ports;
    }
  }

  return remainingPorts;
}

function omitGraphEdgeRoutes(
  edgeRoutes: Record<string, GraphEdgeRoute>,
  entryId: string,
): Record<string, GraphEdgeRoute> {
  const remainingRoutes: Record<string, GraphEdgeRoute> = {};

  for (const [edgeId, route] of Object.entries(edgeRoutes)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      edgeEntryIds &&
      edgeEntryIds.sourceId !== entryId &&
      edgeEntryIds.targetId !== entryId
    ) {
      remainingRoutes[edgeId] = route;
    }
  }

  return remainingRoutes;
}

function omitGraphEdgeItems(
  edgeItems: Record<string, string[]>,
  entryId: string,
): Record<string, string[]> {
  const remainingEdgeItems: Record<string, string[]> = {};

  for (const [edgeId, itemKeys] of Object.entries(edgeItems)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      edgeEntryIds &&
      edgeEntryIds.sourceId !== entryId &&
      edgeEntryIds.targetId !== entryId
    ) {
      remainingEdgeItems[edgeId] = itemKeys;
    }
  }

  return remainingEdgeItems;
}

function omitGraphExternalItems(
  externalItems: Record<string, string[]>,
  entryId: string,
): Record<string, string[]> {
  const remainingExternalItems: Record<string, string[]> = {};

  for (const [terminalId, itemKeys] of Object.entries(externalItems)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (terminalEntry && terminalEntry.entryId !== entryId) {
      remainingExternalItems[terminalId] = itemKeys;
    }
  }

  return remainingExternalItems;
}

function omitGraphTerminalSides(
  terminalSides: Record<string, GraphSide>,
  entryId: string,
): Record<string, GraphSide> {
  const remainingTerminalSides: Record<string, GraphSide> = {};

  for (const [terminalId, side] of Object.entries(terminalSides)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (terminalEntry && terminalEntry.entryId !== entryId) {
      remainingTerminalSides[terminalId] = side;
    }
  }

  return remainingTerminalSides;
}

function pruneRelayEdgeItems(
  edgeItems: Record<string, string[]>,
  relayId: string,
  relayItemKeys: Set<string>,
): Record<string, string[]> {
  const remainingEdgeItems: Record<string, string[]> = {};

  for (const [edgeId, itemKeys] of Object.entries(edgeItems)) {
    const edgeEntryIds = parseGraphEdgeId(edgeId);

    if (
      !edgeEntryIds ||
      (edgeEntryIds.sourceId !== relayId && edgeEntryIds.targetId !== relayId)
    ) {
      remainingEdgeItems[edgeId] = itemKeys;
      continue;
    }

    remainingEdgeItems[edgeId] = itemKeys.filter((itemKey) =>
      relayItemKeys.has(itemKey),
    );
  }

  return remainingEdgeItems;
}

function pruneRelayExternalItems(
  externalItems: Record<string, string[]>,
  relayId: string,
  relayItemKeys: Set<string>,
): Record<string, string[]> {
  const remainingExternalItems: Record<string, string[]> = {};

  for (const [terminalId, itemKeys] of Object.entries(externalItems)) {
    const terminalEntry = parseGraphTerminalId(terminalId);

    if (!terminalEntry || terminalEntry.entryId !== relayId) {
      remainingExternalItems[terminalId] = itemKeys;
      continue;
    }

    const remainingItemKeys = itemKeys.filter((itemKey) =>
      relayItemKeys.has(itemKey),
    );

    if (remainingItemKeys.length) {
      remainingExternalItems[terminalId] = remainingItemKeys;
    }
  }

  return remainingExternalItems;
}

function parseGraphEdgeId(edgeId: string): { sourceId: string; targetId: string } | null {
  const separator = edgeId.indexOf("->");

  if (separator <= 0 || separator >= edgeId.length - 2) {
    return null;
  }

  return {
    sourceId: edgeId.slice(0, separator),
    targetId: edgeId.slice(separator + 2),
  };
}

function parseGraphTerminalId(
  terminalId: string,
): { entryId: string; kind: GraphTerminalKind } | null {
  const separator = terminalId.lastIndexOf(":");

  if (separator <= 0 || separator >= terminalId.length - 1) {
    return null;
  }

  const kind = terminalId.slice(separator + 1);

  if (kind !== "input" && kind !== "output") {
    return null;
  }

  return {
    entryId: terminalId.slice(0, separator),
    kind,
  };
}

function isGraphSide(value: unknown): value is GraphSide {
  return value === "top" || value === "right" || value === "bottom" || value === "left";
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

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value.filter((itemKey): itemKey is string => typeof itemKey === "string"),
  );
}

function parseOrderedStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueOrderedStrings(
    value.filter((itemKey): itemKey is string => typeof itemKey === "string"),
  );
}

function sanitizeLayoutIconIds(iconIds: readonly string[] | undefined): string[] {
  return uniqueOrderedStrings([...(iconIds ?? [])])
    .filter((iconId) => explorerData.iconById.has(iconId));
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
    ? { type: "item", name: product.name, amount: 1 }
    : { type: "fluid", name: product.name, amount: 1 };
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

function uniqueProducts(entries: ProductPrototype[]): ProductPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueOrderedStrings(values: string[]): string[] {
  const seenValues = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeProductionSize(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 1_000_000) / 1_000_000
    : defaultProductionSize;
}

function isDefaultProductionSize(value: number): boolean {
  return normalizeProductionSize(value) === defaultProductionSize;
}

function parseItemId(value: string | null): string | null {
  return value && explorerData.itemById.has(value) ? value : null;
}

function parseAppView(value: string | null): AppView {
  return value === "layouts" || value === "graph" || value === "recipes"
    ? value
    : defaultAppView;
}

function parseGraphLayoutId(
  value: string | null,
  layouts: RecipeLayout[],
): string | null {
  return value && layouts.some((layout) => layout.id === value) ? value : null;
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

interface RecipeRelationshipFilter {
  direction: "made-by" | "used-in";
  selectedItemId: string;
}

function filterRecipes(
  recipes: RecipePrototype[],
  filters: FilterState,
  relationship: RecipeRelationshipFilter,
): RecipePrototype[] {
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

    if (
      relationship.direction === "made-by" &&
      filters.madeByNoByproducts &&
      !isOnlyRecipeOutput(recipe, relationship.selectedItemId)
    ) {
      return false;
    }

    if (
      relationship.direction === "used-in" &&
      filters.usedInNoCoInputs &&
      !isOnlyRecipeInput(recipe, relationship.selectedItemId)
    ) {
      return false;
    }

    return true;
  });
}

function isOnlyRecipeOutput(recipe: RecipePrototype, selectedItemId: string): boolean {
  const results = recipe.results ?? [];

  return results.length === 1 && results[0]?.name === selectedItemId;
}

function isOnlyRecipeInput(recipe: RecipePrototype, selectedItemId: string): boolean {
  const ingredients = recipe.ingredients ?? [];

  return ingredients.length === 1 && ingredients[0]?.name === selectedItemId;
}
