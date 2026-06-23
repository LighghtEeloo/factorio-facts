import {
  ArrowRight,
  Boxes,
  BookmarkPlus,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Import,
  Network,
  PackageOpen,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FactorioLabIcon } from "../../factoriolab/types";
import type {
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import {
  getCompositeRecipeIconIds,
  getCompositeRecipeOrderedIconIds,
  getCompositeRecipeVisibleIconIds,
  getRecipeLayoutTitle,
  inferLayoutCompositeBoundary,
  isCompositeRecipe,
} from "../composite-recipes";
import {
  getBeaconModuleCapacity,
  getBeaconModuleOptions,
  getBeaconOptions,
  getDefaultBeaconModuleSettings,
  getDefaultBeaconSettings,
  getDefaultMachineModuleSettings,
  getFactorySettingsSummaryCount,
  getMachineModuleCapacity,
  getRecipeModuleOptions,
  getRecipeSelectedMachineId,
  sanitizeBeaconSettings,
  sanitizeModuleSettings,
  type LayoutFactoryItemOption,
} from "../layout-factory-settings";
import type {
  LayoutBeaconSettings,
  LayoutCompositeBoundary,
  LayoutModuleSettings,
  LayoutReorderPlacement,
  RecipeLayout,
  RecipeLayoutEntry,
} from "../types";
import { IconSprite } from "./IconSprite";
import { CompositeRecipeIcon, RecipeIcon } from "./RecipeIcon";
import {
  LayoutExportDialog,
  LayoutImportDialog,
} from "./LayoutStringDialogs";
import { RecipeMetaPills } from "./RecipeMetaPills";

interface LayoutWorkspaceProps {
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  onCreateLayout(): void;
  onDeleteLayout(layoutId: string): void;
  onExportLayout(layoutId: string): string | null;
  onImportLayout(layoutId: string, value: string): boolean;
  onInstallLayout(layoutId: string): void;
  onLayoutIconSettingsChange(
    layoutId: string,
    iconIds: string[],
    hiddenIconIds: string[],
  ): void;
  onOpenLayoutGraph(layoutId: string): void;
  onRecipeBeaconsChange(
    layoutId: string,
    entryId: string,
    beacons: LayoutBeaconSettings[],
  ): void;
  onRecipeMachineChange(layoutId: string, entryId: string, machineId: string): void;
  onRecipeModulesChange(
    layoutId: string,
    entryId: string,
    modules: LayoutModuleSettings[],
  ): void;
  onRecipeProductionSizeChange(
    layoutId: string,
    entryId: string,
    productionSize: number,
  ): void;
  onRemoveRecipeFromLayout(layoutId: string, entryId: string): void;
  onRenameLayout(layoutId: string, name: string): void;
  onReorderRecipeInLayout(
    layoutId: string,
    sourceEntryId: string,
    targetEntryId: string,
    placement: LayoutReorderPlacement,
  ): void;
  onSelectItem(itemId: string): void;
}

export function LayoutWorkspace({
  data,
  focusedLayoutId,
  layouts,
  onCreateLayout,
  onDeleteLayout,
  onExportLayout,
  onImportLayout,
  onInstallLayout,
  onLayoutIconSettingsChange,
  onOpenLayoutGraph,
  onRecipeBeaconsChange,
  onRecipeMachineChange,
  onRecipeModulesChange,
  onRecipeProductionSizeChange,
  onRemoveRecipeFromLayout,
  onRenameLayout,
  onReorderRecipeInLayout,
  onSelectItem,
}: LayoutWorkspaceProps) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [entryDropTarget, setEntryDropTarget] = useState<{
    entryId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pendingInspectorFocusEntryId, setPendingInspectorFocusEntryId] =
    useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const focusedLayout =
    layouts.find((layout) => layout.id === focusedLayoutId) ?? layouts[0] ?? null;
  const selectedEntry =
    focusedLayout?.entries.find((entry) => entry.id === selectedEntryId) ??
    focusedLayout?.entries[0] ??
    null;
  const selectedRecipe = selectedEntry
    ? data.recipeById.get(selectedEntry.recipeId) ?? null
    : null;
  const compositeBoundary = focusedLayout
    ? inferLayoutCompositeBoundary(focusedLayout, data.recipeById)
    : { ingredients: [], results: [] };
  const title = focusedLayout
    ? getRecipeLayoutTitle(data, focusedLayout, compositeBoundary.results)
    : "Untitled layout";
  const compositeOrderedIconIds = getCompositeRecipeOrderedIconIds(
    data,
    compositeBoundary.results,
    focusedLayout?.iconIds ?? [],
  );
  const compositeVisibleIconIds = getCompositeRecipeVisibleIconIds(
    data,
    compositeBoundary.results,
    focusedLayout?.iconIds ?? [],
    focusedLayout?.hiddenIconIds ?? [],
  );
  const compositeIconIds = getCompositeRecipeIconIds(
    data,
    compositeBoundary.results,
    focusedLayout?.iconIds ?? [],
    focusedLayout?.hiddenIconIds ?? [],
  );
  const compositeIconEntries = getCompositeIconEntries(data, compositeIconIds);
  const compositeOrderedIconEntries = getCompositeIconEntries(
    data,
    compositeOrderedIconIds,
  );

  useEffect(() => {
    if (!focusedLayout?.entries.length) {
      setSelectedEntryId(null);
      setPendingInspectorFocusEntryId(null);
      return;
    }

    if (!focusedLayout.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(focusedLayout.entries[0]?.id ?? null);
    }
  }, [focusedLayout?.entries, focusedLayout?.id, selectedEntryId]);

  useEffect(() => {
    if (!pendingInspectorFocusEntryId) {
      return;
    }

    if (!focusedLayout?.entries.some((entry) => entry.id === pendingInspectorFocusEntryId)) {
      setPendingInspectorFocusEntryId(null);
      return;
    }

    if (selectedEntry?.id !== pendingInspectorFocusEntryId) {
      return;
    }

    inspectorRef.current?.focus();
    setPendingInspectorFocusEntryId(null);
  }, [focusedLayout?.entries, pendingInspectorFocusEntryId, selectedEntry?.id]);

  useEffect(() => {
    if (!draggedEntryId || !focusedLayout) {
      return;
    }

    const activeEntryId = draggedEntryId;
    const activeLayoutId = focusedLayout.id;

    function handlePointerMove(event: PointerEvent) {
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-layout-editor-entry]");
      const targetEntryId = row?.dataset.layoutEditorEntry;

      if (!row || !targetEntryId || targetEntryId === activeEntryId) {
        setEntryDropTarget(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      const placement: LayoutReorderPlacement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";

      setEntryDropTarget({ entryId: targetEntryId, placement });
    }

    function handlePointerUp() {
      if (entryDropTarget) {
        onReorderRecipeInLayout(
          activeLayoutId,
          activeEntryId,
          entryDropTarget.entryId,
          entryDropTarget.placement,
        );
      }

      setDraggedEntryId(null);
      setEntryDropTarget(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedEntryId, entryDropTarget, focusedLayout, onReorderRecipeInLayout]);

  if (!focusedLayout) {
    return (
      <section className="layout-workspace">
        <div className="workspace-empty app-panel">
          <Boxes size={40} aria-hidden="true" />
          <div>
            <h1>No layouts</h1>
            <span>No layout selected</span>
          </div>
          <button className="primary-action-button" type="button" onClick={onCreateLayout}>
            <Plus size={18} aria-hidden="true" />
            New layout
          </button>
        </div>
      </section>
    );
  }

  function openImportDialog() {
    setIsImportDialogOpen(true);
  }

  function closeImportDialog() {
    setIsImportDialogOpen(false);
  }

  function openExportDialog() {
    if (!focusedLayout) {
      return;
    }

    const value = onExportLayout(focusedLayout.id);

    if (value) {
      setExportText(value);
    }
  }

  const layoutEditorStyle = {
    "--layout-editor-machine-width": `${getLayoutMachineSelectionWidth(
      data,
      focusedLayout,
    )}px`,
  } as LayoutEditorStyle;

  return (
    <section className="layout-workspace">
      <header className="layout-workspace__header app-panel">
        <div className="layout-workspace__title">
          {focusedLayout.entries.length ? (
            <CompositeIconEditor
              customIconIds={focusedLayout.iconIds}
              data={data}
              hiddenIconIds={focusedLayout.hiddenIconIds}
              icons={compositeIconEntries}
              orderedIcons={compositeOrderedIconEntries}
              title={title}
              visibleIconCount={compositeVisibleIconIds.length}
              onChange={(iconIds, hiddenIconIds) =>
                onLayoutIconSettingsChange(
                  focusedLayout.id,
                  iconIds,
                  hiddenIconIds,
                )
              }
            />
          ) : (
            <Boxes size={42} aria-hidden="true" />
          )}
          <label className="layout-title-field">
            <input
              aria-label="Layout name"
              placeholder={title}
              value={focusedLayout.name}
              onChange={(event) => onRenameLayout(focusedLayout.id, event.target.value)}
            />
            <span className="layout-title-field__meta">
              {focusedLayout.entries.length ? (
                <span>
                  {compositeBoundary.ingredients.length} in /{" "}
                  {compositeBoundary.results.length} out
                </span>
              ) : null}
              <span className="layout-workspace__count">
                {focusedLayout.entries.length}{" "}
                {focusedLayout.entries.length === 1 ? "recipe" : "recipes"}
              </span>
            </span>
          </label>
        </div>
        <div className="layout-workspace__actions">
          {!focusedLayout.entries.length ? (
            <>
              <button
                aria-label="Delete layout"
                className="icon-button"
                data-tooltip="Delete layout"
                type="button"
                onClick={() => onDeleteLayout(focusedLayout.id)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                aria-label="Export layout"
                className="icon-button"
                data-tooltip="Export layout"
                type="button"
                onClick={openExportDialog}
              >
                <ExternalLink size={18} aria-hidden="true" />
              </button>
              <button
                aria-label="Install as recipe"
                className="icon-button"
                data-tooltip="Install as recipe"
                type="button"
                onClick={() => onInstallLayout(focusedLayout.id)}
              >
                <BookmarkPlus size={18} aria-hidden="true" />
              </button>
              <button
                aria-label="Open layout graph"
                className="icon-button"
                data-tooltip="Open graph"
                type="button"
                onClick={() => onOpenLayoutGraph(focusedLayout.id)}
              >
                <Network size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="layout-workspace__body">
        <section
          className="layout-editor app-panel"
          style={layoutEditorStyle}
          aria-label={`${title} recipes`}
        >
          {focusedLayout.entries.length ? (
            <LayoutCompositeDetails
              boundary={compositeBoundary}
              data={data}
              title={title}
            />
          ) : null}
          <div className="layout-editor__recipes">
            {focusedLayout.entries.length ? (
              focusedLayout.entries.map((entry, index) => {
                const recipe = data.recipeById.get(entry.recipeId);

                if (!recipe) {
                  return null;
                }

                return (
                  <LayoutEditorRecipeRow
                    data={data}
                    dragging={draggedEntryId === entry.id}
                    dropPlacement={
                      entryDropTarget?.entryId === entry.id
                        ? entryDropTarget.placement
                        : null
                    }
                    entry={entry}
                    index={index}
                    key={entry.id}
                    recipe={recipe}
                    selected={selectedEntry?.id === entry.id}
                    onDragStart={() => {
                      setDraggedEntryId(entry.id);
                      setEntryDropTarget(null);
                    }}
                    onProductionSizeChange={(productionSize) =>
                      onRecipeProductionSizeChange(
                        focusedLayout.id,
                        entry.id,
                        productionSize,
                      )
                    }
                    onMachineChange={(machineId) =>
                      onRecipeMachineChange(focusedLayout.id, entry.id, machineId)
                    }
                    onRemove={() => onRemoveRecipeFromLayout(focusedLayout.id, entry.id)}
                    onSelect={() => setSelectedEntryId(entry.id)}
                    onSelectFactorySettings={() => {
                      setSelectedEntryId(entry.id);
                      setPendingInspectorFocusEntryId(entry.id);
                    }}
                    onOpenRecipeContext={onSelectItem}
                  />
                );
              })
            ) : (
              <div className="layout-editor__empty">
                <PackageOpen size={34} aria-hidden="true" />
                <div>
                  <h2>No recipes yet</h2>
                  <span>Empty layout</span>
                </div>
                <button
                  className="primary-action-button"
                  type="button"
                  onClick={openImportDialog}
                >
                  <Import size={18} aria-hidden="true" />
                  Import layout
                </button>
              </div>
            )}
          </div>
        </section>

        <LayoutRecipeInspector
          data={data}
          entry={selectedEntry}
          inspectorRef={inspectorRef}
          recipe={selectedRecipe}
          onBeaconsChange={(beacons) => {
            if (focusedLayout && selectedEntry) {
              onRecipeBeaconsChange(focusedLayout.id, selectedEntry.id, beacons);
            }
          }}
          onModulesChange={(modules) => {
            if (focusedLayout && selectedEntry) {
              onRecipeModulesChange(focusedLayout.id, selectedEntry.id, modules);
            }
          }}
          onOpenRecipeContext={onSelectItem}
        />
      </div>

      {exportText ? (
        <LayoutExportDialog
          text={exportText}
          onClose={() => setExportText(null)}
        />
      ) : null}

      {isImportDialogOpen && focusedLayout ? (
        <LayoutImportDialog
          onClose={closeImportDialog}
          onImport={(value) => onImportLayout(focusedLayout.id, value)}
        />
      ) : null}
    </section>
  );
}

interface LayoutCompositeDetailsProps {
  boundary: LayoutCompositeBoundary;
  data: RecipeExplorerData;
  title: string;
}

function LayoutCompositeDetails({
  boundary,
  data,
  title,
}: LayoutCompositeDetailsProps) {
  return (
    <section className="layout-composite-details" aria-label={`${title} composite recipe`}>
      <div className="layout-composite-details__equation">
        <InspectorMaterialGroup
          data={data}
          entries={boundary.ingredients}
          label="Inputs"
        />
        <ArrowRight size={18} aria-hidden="true" />
        <InspectorMaterialGroup
          data={data}
          entries={boundary.results}
          label="Outputs"
        />
      </div>
    </section>
  );
}

interface CompositeIconEntry {
  icon: FactorioLabIcon | undefined;
  id: string;
  label: string;
}

interface CompositeIconEditorProps {
  customIconIds: string[];
  data: RecipeExplorerData;
  hiddenIconIds: string[];
  icons: CompositeIconEntry[];
  orderedIcons: CompositeIconEntry[];
  title: string;
  visibleIconCount: number;
  onChange(iconIds: string[], hiddenIconIds: string[]): void;
}

function CompositeIconEditor({
  customIconIds,
  data,
  hiddenIconIds,
  icons,
  orderedIcons,
  title,
  visibleIconCount,
  onChange,
}: CompositeIconEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIconId, setDraggedIconId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    iconId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const orderedIconIds = orderedIcons.map((icon) => icon.id);
  const hiddenIconIdSet = new Set(hiddenIconIds);
  const canEdit = orderedIcons.length > 0;
  const hasCustomIconSettings = customIconIds.length > 0 || hiddenIconIds.length > 0;
  const renderedIconCount = Math.min(visibleIconCount, 4);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function commit(nextIconIds: string[], nextHiddenIconIds = hiddenIconIds) {
    const sanitizedIconIds = sanitizeCompositeIconList(
      nextIconIds,
      orderedIcons,
    );
    const sanitizedHiddenIconIds = sanitizeCompositeIconList(
      nextHiddenIconIds,
      orderedIcons,
    );

    onChange(sanitizedIconIds, sanitizedHiddenIconIds);
  }

  function reorderIcon(
    sourceIconId: string,
    targetIconId: string,
    placement: LayoutReorderPlacement,
  ) {
    if (sourceIconId === targetIconId) {
      return;
    }

    const sourceIndex = orderedIconIds.indexOf(sourceIconId);
    const targetIndex = orderedIconIds.indexOf(targetIconId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextIconIds = [...orderedIconIds];
    const [movedIconId] = nextIconIds.splice(sourceIndex, 1);

    if (!movedIconId) {
      return;
    }

    const shiftedTargetIndex = nextIconIds.indexOf(targetIconId);

    if (shiftedTargetIndex < 0) {
      return;
    }

    const insertIndex = shiftedTargetIndex + (placement === "after" ? 1 : 0);

    nextIconIds.splice(insertIndex, 0, movedIconId);
    commit(nextIconIds);
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, iconId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", iconId);
    setDraggedIconId(iconId);
    setDropTarget(null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, iconId: string) {
    if (!draggedIconId || draggedIconId === iconId) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const placement: LayoutReorderPlacement =
      event.clientY < rect.top + rect.height / 2 ? "before" : "after";

    setDropTarget({ iconId, placement });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, iconId: string) {
    const sourceIconId =
      draggedIconId || event.dataTransfer.getData("text/plain") || null;

    event.preventDefault();

    if (!sourceIconId || sourceIconId === iconId) {
      setDraggedIconId(null);
      setDropTarget(null);
      return;
    }

    reorderIcon(sourceIconId, iconId, dropTarget?.placement ?? "before");
    setDraggedIconId(null);
    setDropTarget(null);
  }

  function toggleIcon(iconId: string) {
    const nextHiddenIconIds = hiddenIconIdSet.has(iconId)
      ? hiddenIconIds.filter((hiddenIconId) => hiddenIconId !== iconId)
      : [...hiddenIconIds, iconId];

    commit(orderedIconIds, nextHiddenIconIds);
  }

  return (
    <div className="layout-composite-icon-control" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Edit ${title} recipe icon`}
        className="layout-composite-icon-button"
        data-tooltip={canEdit ? "Edit recipe icon" : "No output icons"}
        disabled={!canEdit}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <CompositeRecipeIcon
          atlas={data.atlas}
          icons={icons}
          label={`${title} icon`}
          size={42}
        />
      </button>

      {isOpen ? (
        <div
          aria-label={`${title} recipe icon`}
          className="layout-icon-editor app-panel"
          role="dialog"
        >
          <header className="layout-icon-editor__header">
            <CompositeRecipeIcon
              atlas={data.atlas}
              icons={icons}
              label={`${title} icon preview`}
              size={48}
            />
            <div className="layout-icon-editor__title">
              <strong>Recipe icon</strong>
              <span>
                {renderedIconCount} shown / {visibleIconCount} selected
              </span>
            </div>
            <button
              aria-label="Reset recipe icon"
              className="icon-button layout-icon-editor__mini-button"
              data-tooltip="Reset icon"
              disabled={!hasCustomIconSettings}
              type="button"
              onClick={() => onChange([], [])}
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </header>

          <section className="layout-icon-editor__section" aria-label="Output icons">
            <span className="layout-icon-editor__section-label">Outputs</span>
            <div className="layout-icon-editor__ordered-list" role="list">
              {orderedIcons.map((entry) => {
                const isVisible = !hiddenIconIdSet.has(entry.id);
                const isDragging = draggedIconId === entry.id;
                const dropPlacement =
                  dropTarget?.iconId === entry.id ? dropTarget.placement : null;
                const rowClassName = [
                  "layout-icon-editor__ordered-row",
                  isVisible ? "layout-icon-editor__ordered-row--visible" : "",
                  isDragging ? "layout-icon-editor__ordered-row--dragging" : "",
                  dropPlacement
                    ? `layout-icon-editor__ordered-row--drop-${dropPlacement}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    className={rowClassName}
                    draggable
                    key={entry.id}
                    role="listitem"
                    onDragEnd={() => {
                      setDraggedIconId(null);
                      setDropTarget(null);
                    }}
                    onDragLeave={() => {
                      if (dropTarget?.iconId === entry.id) {
                        setDropTarget(null);
                      }
                    }}
                    onDragOver={(event) => handleDragOver(event, entry.id)}
                    onDragStart={(event) => handleDragStart(event, entry.id)}
                    onDrop={(event) => handleDrop(event, entry.id)}
                  >
                    <span className="layout-icon-editor__drag-handle" aria-hidden="true">
                      <GripVertical size={14} />
                    </span>
                    <IconSprite
                      atlas={data.atlas}
                      icon={entry.icon}
                      label={entry.label}
                      size={26}
                    />
                    <span className="layout-icon-editor__item-label">
                      <strong>{entry.label}</strong>
                      <small>{entry.id}</small>
                    </span>
                    <label className="layout-icon-editor__visibility-toggle">
                      <input
                        aria-label={`Show ${entry.label}`}
                        checked={isVisible}
                        type="checkbox"
                        onChange={() => toggleIcon(entry.id)}
                      />
                      <span aria-hidden="true" />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function getCompositeIconEntries(
  data: RecipeExplorerData,
  iconIds: readonly string[],
): CompositeIconEntry[] {
  return iconIds.map((iconId) => ({
    icon: data.iconById.get(iconId),
    id: iconId,
    label: data.itemById.get(iconId)?.name ?? formatId(iconId),
  }));
}

function sanitizeCompositeIconList(
  iconIds: readonly string[],
  orderedIcons: readonly CompositeIconEntry[],
): string[] {
  const orderedIconIds = new Set(orderedIcons.map((icon) => icon.id));
  const seenIconIds = new Set<string>();
  const selectedIconIds: string[] = [];

  for (const iconId of iconIds) {
    if (seenIconIds.has(iconId) || !orderedIconIds.has(iconId)) {
      continue;
    }

    seenIconIds.add(iconId);
    selectedIconIds.push(iconId);
  }

  return selectedIconIds;
}

interface LayoutEditorRecipeRowProps {
  data: RecipeExplorerData;
  dragging: boolean;
  dropPlacement: LayoutReorderPlacement | null;
  entry: RecipeLayoutEntry;
  index: number;
  recipe: RecipePrototype;
  selected: boolean;
  onDragStart(): void;
  onMachineChange(machineId: string): void;
  onProductionSizeChange(productionSize: number): void;
  onRemove(): void;
  onSelect(): void;
  onSelectFactorySettings(): void;
  onOpenRecipeContext(itemId: string): void;
}

interface LayoutMachineOption {
  icon: FactorioLabIcon | undefined;
  id: string;
  name: string;
}

type LayoutEditorStyle = CSSProperties & {
  "--layout-editor-machine-width": string;
};

const machineOptionButtonWidth = 32;
const machineOptionGap = 5;
const machineOptionChromeWidth = 8;
const minMachineSelectionWidth = 84;
const maxMachineSelectionWidth = 320;

function getLayoutMachineSelectionWidth(
  data: RecipeExplorerData,
  layout: RecipeLayout,
): number {
  const longestProducerList = layout.entries.reduce((longest, entry) => {
    const recipe = data.recipeById.get(entry.recipeId);

    return recipe
      ? Math.max(longest, getRecipeMetadata(recipe).producers.length)
      : longest;
  }, 0);
  const listWidth =
    longestProducerList > 0
      ? longestProducerList * machineOptionButtonWidth +
        Math.max(0, longestProducerList - 1) * machineOptionGap +
        machineOptionChromeWidth
      : minMachineSelectionWidth;

  return clampNumber(
    listWidth,
    minMachineSelectionWidth,
    maxMachineSelectionWidth,
  );
}

function LayoutEditorRecipeRow({
  data,
  dragging,
  dropPlacement,
  entry,
  index,
  onMachineChange,
  onDragStart,
  onProductionSizeChange,
  onRemove,
  onOpenRecipeContext,
  onSelect,
  onSelectFactorySettings,
  recipe,
  selected,
}: LayoutEditorRecipeRowProps) {
  const metadata = getRecipeMetadata(recipe);
  const isComposite = isCompositeRecipe(recipe);
  const machineOptions = getRecipeMachineOptions(data, metadata.producers);
  const selectedMachine =
    machineOptions.find((option) => option.id === entry.machineId) ??
    machineOptions[0] ??
    null;
  const [productionSizeDraft, setProductionSizeDraft] = useState(
    formatProductionSize(entry.productionSize),
  );

  useEffect(() => {
    setProductionSizeDraft(formatProductionSize(entry.productionSize));
  }, [entry.productionSize]);

  return (
    <div
      className={`layout-editor-row ${selected ? "layout-editor-row--selected" : ""} ${
        dragging ? "layout-editor-row--dragging" : ""
      } ${dropPlacement ? `layout-editor-row--drop-${dropPlacement}` : ""}`}
      data-layout-editor-entry={entry.id}
    >
      <span
        className="layout-editor-row__index"
        data-tooltip="Drag to reorder"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
      >
        <span>{index + 1}</span>
      </span>
      <button
        aria-label={`Inspect ${metadata.name}`}
        aria-pressed={selected}
        className="layout-editor-row__main"
        data-tooltip={`${metadata.name} (${metadata.id})`}
        type="button"
        onClick={onSelect}
        onDoubleClick={() => {
          const contextItemId = getRecipeContextItemId(data, recipe);

          if (contextItemId) {
            onOpenRecipeContext(contextItemId);
          }
        }}
      >
        <RecipeIcon data={data} recipe={recipe} size={34} />
        <span className="layout-editor-row__identity">
          <strong>{metadata.name}</strong>
          <small>{metadata.id}</small>
        </span>
        <span className="layout-editor-row__meta" aria-hidden="true">
          {isComposite ? null : (
            <span>
              <Timer size={13} aria-hidden="true" />
              {formatTime(recipe.energy_required)}
            </span>
          )}
        </span>
      </button>
      {isComposite ? (
        <div className="layout-editor-row__machine layout-editor-row__machine--blank" />
      ) : (
        <div
          aria-label={`${metadata.name} producing machine`}
          className="layout-editor-row__machine"
          role="group"
          data-tooltip={
            selectedMachine ? `Machine: ${selectedMachine.name}` : "No machine choice"
          }
        >
          {machineOptions.length ? (
            machineOptions.map((option) => {
              const isSelected = option.id === selectedMachine?.id;

              return (
                <button
                  aria-label={`Use ${option.name}`}
                  aria-pressed={isSelected}
                  className="layout-editor-row__machine-option"
                  data-tooltip={option.name}
                  key={option.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    if (!isSelected) {
                      onMachineChange(option.id);
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <IconSprite
                    atlas={data.atlas}
                    icon={option.icon}
                    label={option.name}
                    size={22}
                  />
                </button>
              );
            })
          ) : (
            <span className="layout-editor-row__machine-none">natural</span>
          )}
        </div>
      )}
      {isComposite ? (
        <div className="layout-editor-row__factory layout-editor-row__factory--blank" />
      ) : (
        <FactorySettingsSummary
          data={data}
          entry={entry}
          recipeName={metadata.name}
          onSelect={onSelectFactorySettings}
        />
      )}
      <label className="layout-editor-row__size" data-tooltip="Production size">
        <span aria-hidden="true">×</span>
        <input
          aria-label={`${metadata.name} production size`}
          inputMode="decimal"
          min="0.000001"
          step="any"
          type="number"
          value={productionSizeDraft}
          onBlur={() => {
            if (parseProductionSizeInput(productionSizeDraft) === null) {
              setProductionSizeDraft(formatProductionSize(entry.productionSize));
            }
          }}
          onChange={(event) => {
            const nextDraft = event.target.value;
            const productionSize = parseProductionSizeInput(nextDraft);

            setProductionSizeDraft(nextDraft);

            if (productionSize !== null) {
              onProductionSizeChange(productionSize);
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </label>
      <button
        aria-label={`Remove ${metadata.name} from layout`}
        className="layout-editor-row__remove"
        data-tooltip="Remove recipe"
        type="button"
        onClick={onRemove}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function FactorySettingsSummary({
  data,
  entry,
  onSelect,
  recipeName,
}: {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry;
  recipeName: string;
  onSelect(): void;
}) {
  const summaryCount = getFactorySettingsSummaryCount(entry.modules, entry.beacons);

  return (
    <button
      aria-label={`Edit modules and beacons for ${recipeName}`}
      className={`layout-editor-row__factory ${
        summaryCount ? "" : "layout-editor-row__factory--empty"
      }`}
      data-tooltip={summaryCount ? "Factory settings" : "No modules or beacons"}
      type="button"
      onClick={onSelect}
    >
      {entry.modules?.map((module) => (
        <FactorySettingChip
          count={module.count}
          data={data}
          id={module.id}
          key={`module:${module.id}`}
        />
      ))}
      {entry.beacons?.map((beacon, index) => (
        <FactorySettingChip
          count={beacon.count}
          data={data}
          id={beacon.id}
          key={`beacon:${beacon.id}:${index}`}
        />
      ))}
      {summaryCount ? null : <span>empty</span>}
    </button>
  );
}

function FactorySettingChip({
  count,
  data,
  id,
}: {
  count: number;
  data: RecipeExplorerData;
  id: string;
}) {
  const item = data.itemById.get(id);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : id);
  const label = item?.name ?? formatId(id);

  return (
    <span className="factory-setting-chip" title={`${label} x ${formatNumber(count)}`}>
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={20} />
      <em>{formatNumber(count)}</em>
    </span>
  );
}

function getRecipeMachineOptions(
  data: RecipeExplorerData,
  producerIds: string[],
): LayoutMachineOption[] {
  return producerIds.map((producerId) => {
    const item = data.itemById.get(producerId);
    const name = item?.name ?? formatId(producerId);
    const iconId = item ? getIconIdForItem(item) : producerId;

    return {
      icon: data.iconById.get(iconId),
      id: producerId,
      name,
    };
  });
}

interface LayoutRecipeInspectorProps {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry | null;
  inspectorRef: RefObject<HTMLElement | null>;
  recipe: RecipePrototype | null;
  onBeaconsChange(beacons: LayoutBeaconSettings[]): void;
  onModulesChange(modules: LayoutModuleSettings[]): void;
  onOpenRecipeContext(itemId: string): void;
}

function LayoutRecipeInspector({
  data,
  entry,
  inspectorRef,
  onBeaconsChange,
  onModulesChange,
  onOpenRecipeContext,
  recipe,
}: LayoutRecipeInspectorProps) {
  if (!entry || !recipe) {
    return (
      <aside
        ref={inspectorRef}
        className="layout-inspector app-panel"
        aria-label="Recipe inspector"
        tabIndex={-1}
      >
        <div className="layout-inspector__empty">
          <PackageOpen size={34} aria-hidden="true" />
          <div>
            <h2>No recipe selected</h2>
            <span>Select a recipe instance</span>
          </div>
        </div>
      </aside>
    );
  }

  const metadata = getRecipeMetadata(recipe);
  const contextItemId = getRecipeContextItemId(data, recipe);
  const selectedMachineId = getRecipeSelectedMachineId(recipe, entry.machineId);
  const machineModuleOptions = getRecipeModuleOptions(data, recipe, selectedMachineId);
  const machineModuleCapacity = getMachineModuleCapacity(data, selectedMachineId);
  const canUseFactorySettings = machineModuleOptions.length > 0 && Boolean(machineModuleCapacity);
  const tags = [
    ...metadata.flags,
    ...metadata.disallowedEffects.map((effect) => `no ${effect}`),
  ];
  const isComposite = isCompositeRecipe(recipe);

  if (isComposite) {
    return (
      <aside
        ref={inspectorRef}
        className="layout-inspector app-panel"
        aria-label="Recipe inspector"
        tabIndex={-1}
      >
        <header className="layout-inspector__header">
          <RecipeIcon data={data} recipe={recipe} size={42} />
          <div>
            <h2>{metadata.name}</h2>
            <span>{metadata.id}</span>
          </div>
        </header>

        <div className="layout-inspector__stats">
          <span className="layout-inspector__text-pill" title="Production size">
            × {formatProductionSize(entry.productionSize)}
          </span>
        </div>

        <div className="layout-inspector__equation">
          <InspectorMaterialGroup
            data={data}
            entries={recipe.ingredients ?? []}
            label="Inputs"
          />
          <ArrowRight size={18} aria-hidden="true" />
          <InspectorMaterialGroup
            data={data}
            entries={recipe.results ?? []}
            label="Outputs"
          />
        </div>

        <button
          className="layout-inspector__open primary-action-button"
          disabled={!contextItemId}
          type="button"
          onClick={() => {
            if (contextItemId) {
              onOpenRecipeContext(contextItemId);
            }
          }}
        >
          <ExternalLink size={17} aria-hidden="true" />
          Open in Recipes
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={inspectorRef}
      className="layout-inspector app-panel"
      aria-label="Recipe inspector"
      tabIndex={-1}
    >
      <header className="layout-inspector__header">
        <RecipeIcon data={data} recipe={recipe} size={42} />
        <div>
          <h2>{metadata.name}</h2>
          <span>{metadata.id}</span>
        </div>
      </header>

      <RecipeMetaPills
        classNames={{
          icon: "layout-inspector__icon-pill",
          producer: "layout-inspector__icon-pill--producer",
          root: "layout-inspector__stats",
          surface: "layout-inspector__icon-pill--surface",
          text: "layout-inspector__text-pill",
          time: "layout-inspector__text-pill",
        }}
        data={data}
        energyRequired={recipe.energy_required}
        iconSize={24}
        includeAllSurfaces
        leading={
          <span className="layout-inspector__text-pill" title="Production size">
            × {formatProductionSize(entry.productionSize)}
          </span>
        }
        metadata={metadata}
        producerIds={selectedMachineId ? [selectedMachineId] : []}
      />

      <div className="layout-inspector__equation">
        <InspectorMaterialGroup
          data={data}
          entries={recipe.ingredients ?? []}
          label="Ingredients"
        />
        <ArrowRight size={18} aria-hidden="true" />
        <InspectorMaterialGroup
          data={data}
          entries={recipe.results ?? []}
          label="Results"
        />
      </div>

      {tags.length ? (
        <div className="layout-inspector__tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <section className="layout-inspector__factory">
        <header className="layout-inspector__section-heading">
          <h3>Modules</h3>
          {machineModuleCapacity && machineModuleCapacity !== true ? (
            <span>
              {formatNumber(sumModuleCounts(entry.modules))}/
              {formatNumber(machineModuleCapacity)}
            </span>
          ) : null}
        </header>
        {canUseFactorySettings ? (
          <ModuleSettingsRows
            addLabel="Add module"
            capacity={machineModuleCapacity}
            data={data}
            emptyLabel="No modules selected"
            options={machineModuleOptions}
            value={entry.modules ?? []}
            onChange={onModulesChange}
          />
        ) : (
          <p className="layout-inspector__muted">Selected machine has no module slots.</p>
        )}
      </section>

      <section className="layout-inspector__factory">
        <header className="layout-inspector__section-heading">
          <h3>Beacons</h3>
        </header>
        {canUseFactorySettings ? (
          <BeaconSettingsRows
            data={data}
            value={entry.beacons ?? []}
            onChange={onBeaconsChange}
          />
        ) : (
          <p className="layout-inspector__muted">Beacons need a module-capable machine.</p>
        )}
      </section>

      <button
        className="layout-inspector__open primary-action-button"
        disabled={!contextItemId}
        type="button"
        onClick={() => {
          if (contextItemId) {
            onOpenRecipeContext(contextItemId);
          }
        }}
      >
        <ExternalLink size={17} aria-hidden="true" />
        Open in Recipes
      </button>
    </aside>
  );
}

interface ModuleSettingsRowsProps {
  addLabel: string;
  capacity: number | true | null;
  data: RecipeExplorerData;
  emptyLabel: string;
  getDefaultSetting?(): LayoutModuleSettings | null;
  options: LayoutFactoryItemOption[];
  value: LayoutModuleSettings[];
  onChange(value: LayoutModuleSettings[]): void;
}

function ModuleSettingsRows({
  addLabel,
  capacity,
  data,
  emptyLabel,
  getDefaultSetting,
  options,
  value,
  onChange,
}: ModuleSettingsRowsProps) {
  const usedSlots = sumModuleCounts(value);
  const finiteCapacity = capacity === true ? null : capacity;
  const remainingSlots =
    finiteCapacity === null ? Number.POSITIVE_INFINITY : Math.max(0, finiteCapacity - usedSlots);
  const canAdd = options.length > 0 && remainingSlots > 0;

  function commit(nextValue: LayoutModuleSettings[]) {
    onChange(sanitizeModuleSettings(nextValue, options, capacity));
  }

  function addModule() {
    if (!canAdd) {
      return;
    }

    const defaults = getDefaultSetting
      ? [getDefaultSetting()].filter(
          (setting): setting is LayoutModuleSettings => setting !== null,
        )
      : getDefaultMachineModuleSettings(options, capacity);
    const fallbackId = options[0]?.id;
    const nextSetting = defaults[0] ?? (fallbackId ? { id: fallbackId, count: 1 } : null);

    if (!nextSetting) {
      return;
    }

    commit([...value, { ...nextSetting, count: Math.min(nextSetting.count, remainingSlots) }]);
  }

  return (
    <div className="factory-settings-editor">
      {value.length ? (
        value.map((setting, index) => (
          <FactoryModuleSettingRow
            data={data}
            key={`${setting.id}:${index}`}
            options={options}
            setting={setting}
            onCountChange={(count) =>
              commit(value.map((item, itemIndex) =>
                itemIndex === index ? { ...item, count } : item,
              ))
            }
            onIdChange={(id) =>
              commit(value.map((item, itemIndex) =>
                itemIndex === index ? { ...item, id } : item,
              ))
            }
            onRemove={() => commit(value.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))
      ) : (
        <p className="layout-inspector__muted">{emptyLabel}</p>
      )}
      <button
        className="factory-settings-editor__add"
        disabled={!canAdd}
        type="button"
        onClick={addModule}
      >
        <Plus size={15} aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

interface FactoryModuleSettingRowProps {
  data: RecipeExplorerData;
  options: LayoutFactoryItemOption[];
  setting: LayoutModuleSettings;
  onCountChange(count: number): void;
  onIdChange(id: string): void;
  onRemove(): void;
}

function FactoryModuleSettingRow({
  data,
  onCountChange,
  onIdChange,
  onRemove,
  options,
  setting,
}: FactoryModuleSettingRowProps) {
  const selectedOption = getSelectedFactoryOption(data, options, setting.id);

  return (
    <div className="factory-settings-row">
      <FactoryIconDropdown
        ariaLabel="Module"
        data={data}
        options={options}
        value={setting.id}
        onChange={onIdChange}
      />
      <FactoryCountInput
        ariaLabel={`${selectedOption.name} count`}
        value={setting.count}
        onChange={onCountChange}
      />
      <button
        aria-label={`Remove ${selectedOption.name}`}
        className="factory-settings-row__remove"
        data-tooltip="Remove"
        type="button"
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

interface FactoryIconDropdownProps {
  ariaLabel: string;
  data: RecipeExplorerData;
  options: LayoutFactoryItemOption[];
  value: string;
  onChange(id: string): void;
}

function FactoryIconDropdown({
  ariaLabel,
  data,
  onChange,
  options,
  value,
}: FactoryIconDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = getSelectedFactoryOption(data, options, value);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="factory-icon-dropdown" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="factory-icon-dropdown__button"
        data-tooltip={selectedOption.name}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <IconSprite
          atlas={data.atlas}
          icon={selectedOption.icon}
          label={selectedOption.name}
          size={24}
        />
        <ChevronDown
          className="factory-icon-dropdown__chevron"
          size={10}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="factory-icon-dropdown__menu" role="menu" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.id === value;

            return (
              <button
                aria-checked={selected}
                aria-label={option.name}
                className="factory-icon-dropdown__option"
                data-tooltip={option.name}
                key={option.id}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  if (!selected) {
                    onChange(option.id);
                  }

                  setOpen(false);
                }}
              >
                <IconSprite
                  atlas={data.atlas}
                  icon={option.icon}
                  label={option.name}
                  size={24}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface FactoryCountInputProps {
  ariaLabel: string;
  value: number;
  onChange(value: number): void;
}

function FactoryCountInput({ ariaLabel, onChange, value }: FactoryCountInputProps) {
  const [draft, setDraft] = useState(formatFactoryCountInput(value));

  useEffect(() => {
    setDraft(formatFactoryCountInput(value));
  }, [value]);

  return (
    <input
      aria-label={ariaLabel}
      inputMode="decimal"
      min="0"
      step="1"
      type="number"
      value={draft}
      onBlur={() => {
        if (!draft.trim() || parseFactoryCountInput(draft) !== null) {
          return;
        }

        setDraft(formatFactoryCountInput(value));
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        const nextValue = parseFactoryCountInput(nextDraft);

        setDraft(nextDraft);

        if (nextValue !== null) {
          onChange(nextValue);
        }
      }}
    />
  );
}

interface BeaconSettingsRowsProps {
  data: RecipeExplorerData;
  value: LayoutBeaconSettings[];
  onChange(value: LayoutBeaconSettings[]): void;
}

function BeaconSettingsRows({ data, onChange, value }: BeaconSettingsRowsProps) {
  const beaconOptions = getBeaconOptions(data);

  function commit(nextValue: LayoutBeaconSettings[]) {
    onChange(sanitizeBeaconSettings(data, nextValue));
  }

  function addBeacon() {
    const defaults = getDefaultBeaconSettings(data);
    const fallbackBeacon = beaconOptions[0];

    if (defaults[0]) {
      commit([...value, defaults[0]]);
    } else if (fallbackBeacon) {
      commit([...value, { id: fallbackBeacon.id, count: 1, modules: [] }]);
    }
  }

  return (
    <div className="factory-settings-editor">
      {value.length ? (
        value.map((beacon, index) => {
          const moduleOptions = getBeaconModuleOptions(data, beacon.id);
          const moduleCapacity = getBeaconModuleCapacity(data, beacon.id);
          const selectedOption = getSelectedFactoryOption(data, beaconOptions, beacon.id);

          return (
            <div className="beacon-settings-card" key={`${beacon.id}:${index}`}>
              <div className="factory-settings-row">
                <FactoryIconDropdown
                  ariaLabel="Beacon"
                  data={data}
                  options={beaconOptions}
                  value={beacon.id}
                  onChange={(nextBeaconId) => {
                    const nextModules = sanitizeModuleSettings(
                      beacon.modules,
                      getBeaconModuleOptions(data, nextBeaconId),
                      getBeaconModuleCapacity(data, nextBeaconId),
                    );

                    commit(value.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, id: nextBeaconId, modules: nextModules }
                        : item,
                    ));
                  }}
                />
                <FactoryCountInput
                  ariaLabel={`${selectedOption.name} count`}
                  value={beacon.count}
                  onChange={(count) =>
                    commit(value.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, count } : item,
                    ))
                  }
                />
                <button
                  aria-label={`Remove ${selectedOption.name}`}
                  className="factory-settings-row__remove"
                  data-tooltip="Remove"
                  type="button"
                  onClick={() => commit(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <ModuleSettingsRows
                addLabel="Add beacon module"
                capacity={moduleCapacity}
                data={data}
                emptyLabel="No beacon modules selected"
                getDefaultSetting={() =>
                  getDefaultBeaconModuleSettings(data, beacon.id)[0] ?? null
                }
                options={moduleOptions}
                value={beacon.modules}
                onChange={(modules) =>
                  commit(value.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, modules } : item,
                  ))
                }
              />
            </div>
          );
        })
      ) : (
        <p className="layout-inspector__muted">No beacons selected</p>
      )}
      <button
        className="factory-settings-editor__add"
        disabled={!beaconOptions.length}
        type="button"
        onClick={addBeacon}
      >
        <Plus size={15} aria-hidden="true" />
        Add beacon
      </button>
    </div>
  );
}

function sumModuleCounts(modules: readonly LayoutModuleSettings[] | undefined): number {
  return modules?.reduce((sum, module) => sum + module.count, 0) ?? 0;
}

interface InspectorMaterialGroupProps {
  data: RecipeExplorerData;
  entries: readonly (IngredientPrototype | ProductPrototype)[];
  label: string;
}

function InspectorMaterialGroup({
  data,
  entries,
  label,
}: InspectorMaterialGroupProps) {
  return (
    <section className="layout-inspector__section">
      <h3>{label}</h3>
      {entries.length ? (
        <ul className="layout-inspector__materials">
          {entries.map((entry, index) => (
            <InspectorMaterial
              data={data}
              entry={entry}
              key={`${materialKey(entry)}:${index}`}
            />
          ))}
        </ul>
      ) : (
        <span className="layout-inspector__none">none</span>
      )}
    </section>
  );
}

interface InspectorMaterialProps {
  data: RecipeExplorerData;
  entry: IngredientPrototype | ProductPrototype;
}

function InspectorMaterial({ data, entry }: InspectorMaterialProps) {
  const item = data.itemById.get(entry.name);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : entry.name);
  const label = item?.name ?? formatId(entry.name);

  return (
    <li className="layout-inspector__material">
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
      <span>
        <strong>{label}</strong>
        <small>{entry.name}</small>
      </span>
      <em>{formatMaterialAmount(entry)}</em>
    </li>
  );
}

function formatProductionSize(value: number): string {
  return Number.isFinite(value) ? String(value) : "1";
}

function parseProductionSizeInput(value: string): number | null {
  const productionSize = Number(value);

  return Number.isFinite(productionSize) && productionSize > 0
    ? productionSize
    : null;
}

function formatFactoryCountInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function parseFactoryCountInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const count = Number(value);

  return Number.isFinite(count) && count >= 0 ? count : null;
}

function getSelectedFactoryOption(
  data: RecipeExplorerData,
  options: readonly LayoutFactoryItemOption[],
  id: string,
): LayoutFactoryItemOption {
  const option = options.find((item) => item.id === id);

  if (option) {
    return option;
  }

  const item = data.itemById.get(id);
  const iconId = item ? getIconIdForItem(item) : id;

  return {
    icon: data.iconById.get(iconId),
    id,
    name: item?.name ?? formatId(id),
  };
}

function getRecipeContextItemId(
  data: RecipeExplorerData,
  recipe: RecipePrototype,
): string | null {
  const resultItem = recipe.results?.find((entry) => data.itemById.has(entry.name));

  if (resultItem) {
    return resultItem.name;
  }

  return recipe.ingredients?.find((entry) => data.itemById.has(entry.name))?.name ?? null;
}

function formatMaterialAmount(entry: IngredientPrototype | ProductPrototype): string {
  const amount = "amount" in entry ? entry.amount : undefined;
  const amountMin = "amount_min" in entry ? entry.amount_min : undefined;
  const amountMax = "amount_max" in entry ? entry.amount_max : undefined;
  const amountText =
    amount !== undefined
      ? formatNumber(amount)
      : amountMin !== undefined && amountMax !== undefined
        ? `${formatNumber(amountMin)}-${formatNumber(amountMax)}`
        : "var";
  const probability =
    "probability" in entry && typeof entry.probability === "number" && entry.probability < 1
      ? `, ${formatNumber(entry.probability * 100)}%`
      : "";
  const temperature =
    entry.type === "fluid" &&
    "temperature" in entry &&
    typeof entry.temperature === "number"
      ? `, ${formatNumber(entry.temperature)}C`
      : "";

  return `${amountText}${probability}${temperature}`;
}

function materialKey(entry: IngredientPrototype | ProductPrototype): string {
  return `${entry.type}:${entry.name}:${formatMaterialAmount(entry)}`;
}

function formatTime(value: number | undefined): string {
  if (value === undefined) {
    return "time n/a";
  }

  return `${formatNumber(value)}s`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return `${Number(value.toFixed(3))}`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
