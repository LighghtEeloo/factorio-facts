import {
  ArrowRight,
  Boxes,
  BookmarkPlus,
  Check,
  ExternalLink,
  FlaskConical,
  GripVertical,
  Import,
  Lock,
  Network,
  Package,
  PackageOpen,
  Pickaxe,
  Plus,
  Recycle,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  type ReactNode,
  type DragEvent,
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
import type {
  LayoutCompositeBoundary,
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
import {
  LayoutWorkbenchHeader,
  LayoutWorkbenchTitle,
} from "./LayoutWorkbenchHeader";
import { RecipeColumn } from "./RecipeColumn";
import { RecipeMetaPills } from "./RecipeMetaPills";

interface LayoutWorkspaceProps {
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layoutOverride?: RecipeLayout | null;
  layouts: RecipeLayout[];
  getFocusedLayoutRecipeCount(recipeId: string): number;
  onCreateLayout(): void;
  onAddRecipeToLayout(recipeId: string): string | null | void;
  onDeleteLayout(layoutId: string): void;
  onExportLayout(layoutId: string): string | null;
  onImportLayout(layoutId: string, value: string): boolean;
  onInstallLayout(layoutId: string): void;
  onLayoutIconSettingsChange(
    layoutId: string,
    iconIds: string[],
    hiddenIconIds: string[],
  ): void;
  onOpenItemSelector(): void;
  onOpenLayoutGraph(layoutId: string): void;
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
  readOnly?: boolean;
  readOnlyLabel?: string;
}

export function LayoutWorkspace({
  data,
  focusedLayoutId,
  getFocusedLayoutRecipeCount,
  layoutOverride = null,
  layouts,
  onAddRecipeToLayout,
  onCreateLayout,
  onDeleteLayout,
  onExportLayout,
  onImportLayout,
  onInstallLayout,
  onLayoutIconSettingsChange,
  onOpenItemSelector,
  onOpenLayoutGraph,
  onRecipeProductionSizeChange,
  onRemoveRecipeFromLayout,
  onRenameLayout,
  onReorderRecipeInLayout,
  onSelectItem,
  readOnly = false,
  readOnlyLabel = "Read only",
}: LayoutWorkspaceProps) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [entryDropTarget, setEntryDropTarget] = useState<{
    entryId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [relatedRecipeContext, setRelatedRecipeContext] =
    useState<InspectorRelatedRecipeContext | null>(null);
  const [relatedRecipeFlagFilters, setRelatedRecipeFlagFilters] =
    useState<InspectorRecipeFlagFilters>(defaultInspectorRecipeFlagFilters);
  const focusedLayout =
    layoutOverride ??
    layouts.find((layout) => layout.id === focusedLayoutId) ??
    layouts[0] ??
    null;
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
      return;
    }

    if (!focusedLayout.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(focusedLayout.entries[0]?.id ?? null);
    }
  }, [focusedLayout?.entries, focusedLayout?.id, selectedEntryId]);

  useEffect(() => {
    setIsDeleteConfirming(false);
  }, [focusedLayout?.id]);

  useEffect(() => {
    setRelatedRecipeContext(null);
  }, [focusedLayout?.id, selectedEntry?.id, selectedRecipe?.name]);

  useEffect(() => {
    if (!readOnly) {
      return;
    }

    setDraggedEntryId(null);
    setEntryDropTarget(null);
    setIsDeleteConfirming(false);
    setIsImportDialogOpen(false);
    setExportText(null);
  }, [focusedLayout?.id, readOnly]);

  useEffect(() => {
    if (readOnly || !draggedEntryId || !focusedLayout) {
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
  }, [draggedEntryId, entryDropTarget, focusedLayout, onReorderRecipeInLayout, readOnly]);

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
    if (readOnly) {
      return;
    }

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

  function addRecipeToLayoutAndSelect(recipeId: string) {
    if (readOnly) {
      return;
    }

    const entryId = onAddRecipeToLayout(recipeId);

    if (typeof entryId === "string") {
      setSelectedEntryId(entryId);
    }
  }

  function confirmDeleteLayout() {
    if (readOnly || !focusedLayout) {
      return;
    }

    onDeleteLayout(focusedLayout.id);
    setIsDeleteConfirming(false);
  }

  function renderDeleteControl() {
    if (readOnly) {
      return null;
    }

    return isDeleteConfirming ? (
      <div
        aria-label="Confirm layout delete"
        className="layout-inline-confirm"
        role="group"
      >
        <span className="layout-inline-confirm__label">Delete?</span>
        <button
          aria-label="Confirm layout delete"
          className="icon-button layout-inline-confirm__button"
          data-tooltip="Confirm delete"
          type="button"
          onClick={confirmDeleteLayout}
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Cancel layout delete"
          className="icon-button layout-inline-confirm__button"
          data-tooltip="Cancel delete"
          type="button"
          onClick={() => setIsDeleteConfirming(false)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    ) : (
      <button
        aria-label="Delete layout"
        className="icon-button"
        data-tooltip="Delete layout"
        type="button"
        onClick={() => setIsDeleteConfirming(true)}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <section className="layout-workspace">
      <LayoutWorkbenchHeader
        panel
        actions={
          readOnly ? (
            <>
              {focusedLayout.entries.length ? (
                <button
                  aria-label="Open installed layout graph"
                  className="icon-button"
                  data-tooltip="Open graph"
                  type="button"
                  onClick={() => onOpenLayoutGraph(focusedLayout.id)}
                >
                  <Network size={18} aria-hidden="true" />
                </button>
              ) : null}
              <span className="layout-readonly-badge">{readOnlyLabel}</span>
            </>
          ) : !focusedLayout.entries.length ? (
            renderDeleteControl()
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
                aria-label="Open layout graph"
                className="icon-button"
                data-tooltip="Open graph"
                type="button"
                onClick={() => onOpenLayoutGraph(focusedLayout.id)}
              >
                <Network size={18} aria-hidden="true" />
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
              {renderDeleteControl()}
            </>
          )
        }
        title={
          <LayoutWorkbenchTitle
            icon={
              focusedLayout.entries.length ? (
                readOnly ? (
                  <CompositeRecipeIcon
                    atlas={data.atlas}
                    icons={compositeIconEntries}
                    label={`${title} icon`}
                    size={42}
                  />
                ) : (
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
                )
              ) : (
                <Boxes size={42} aria-hidden="true" />
              )
            }
            meta={
              <>
                {focusedLayout.entries.length ? (
                  <span>
                    {compositeBoundary.ingredients.length} in /{" "}
                    {compositeBoundary.results.length} out
                  </span>
                ) : null}
                <span className="layout-workbench-title__count">
                  {focusedLayout.entries.length}{" "}
                  {focusedLayout.entries.length === 1 ? "recipe" : "recipes"}
                </span>
              </>
            }
            name={focusedLayout.name}
            title={title}
            {...(readOnly
              ? {}
              : {
                  onNameChange: (name: string) =>
                    onRenameLayout(focusedLayout.id, name),
                })}
          />
        }
      />

      <div className="layout-workspace__body">
        <section
          className="layout-editor app-panel"
          aria-label={`${title} recipes`}
        >
          <div className="layout-editor__recipes">
            {focusedLayout.entries.length ? (
              <>
                <LayoutCompositeDetails
                  boundary={compositeBoundary}
                  data={data}
                  relatedRecipeContext={relatedRecipeContext}
                  title={title}
                  onSelectRelatedRecipeContext={setRelatedRecipeContext}
                />
                {focusedLayout.entries.map((entry, index) => {
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
                      readOnly={readOnly}
                      selected={selectedEntry?.id === entry.id}
                      onDragStart={() => {
                        if (readOnly) {
                          return;
                        }

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
                      onRemove={() => onRemoveRecipeFromLayout(focusedLayout.id, entry.id)}
                      onSelect={() => setSelectedEntryId(entry.id)}
                      onOpenRecipeContext={onSelectItem}
                    />
                  );
                })}
              </>
            ) : (
              <div className="layout-editor__empty">
                <PackageOpen size={34} aria-hidden="true" />
                <div>
                  <h2>No recipes yet</h2>
                  <span>Empty layout</span>
                </div>
                <div className="layout-editor__empty-actions">
                  {readOnly ? (
                    <span className="layout-readonly-badge">{readOnlyLabel}</span>
                  ) : (
                    <>
                      <button
                        className="primary-action-button"
                        type="button"
                        onClick={onOpenItemSelector}
                      >
                        <Package size={18} aria-hidden="true" />
                        Select item
                      </button>
                      <button
                        className="secondary-action-button"
                        type="button"
                        onClick={openImportDialog}
                      >
                        <Import size={18} aria-hidden="true" />
                        Import layout
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <LayoutRecipeInspector
          data={data}
          entry={selectedEntry}
          getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
          relatedRecipeContext={relatedRecipeContext}
          relatedRecipeFlagFilters={relatedRecipeFlagFilters}
          onRelatedRecipeContextChange={setRelatedRecipeContext}
          onRelatedRecipeFlagFiltersChange={setRelatedRecipeFlagFilters}
          {...(readOnly
            ? {}
            : { onAddRecipeToLayout: addRecipeToLayoutAndSelect })}
          recipe={selectedRecipe}
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
  relatedRecipeContext: InspectorRelatedRecipeContext | null;
  title: string;
  onSelectRelatedRecipeContext(context: InspectorRelatedRecipeContext): void;
}

function LayoutCompositeDetails({
  boundary,
  data,
  relatedRecipeContext,
  title,
  onSelectRelatedRecipeContext,
}: LayoutCompositeDetailsProps) {
  return (
    <section className="layout-composite-details" aria-label={`${title} composite recipe`}>
      <div className="layout-composite-details__equation">
        <InspectorMaterialGroup
          data={data}
          entries={boundary.ingredients}
          label="Inputs"
          relatedRecipeContext={relatedRecipeContext}
          relatedVariant="made-by"
          onSelectRelatedRecipeContext={onSelectRelatedRecipeContext}
        />
        <ArrowRight size={18} aria-hidden="true" />
        <InspectorMaterialGroup
          data={data}
          entries={boundary.results}
          label="Outputs"
          relatedRecipeContext={relatedRecipeContext}
          relatedVariant="used-in"
          onSelectRelatedRecipeContext={onSelectRelatedRecipeContext}
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
  readOnly: boolean;
  recipe: RecipePrototype;
  selected: boolean;
  onDragStart(): void;
  onProductionSizeChange(productionSize: number): void;
  onRemove(): void;
  onSelect(): void;
  onOpenRecipeContext(itemId: string): void;
}

function LayoutEditorRecipeRow({
  data,
  dragging,
  dropPlacement,
  entry,
  index,
  onDragStart,
  onProductionSizeChange,
  onRemove,
  onOpenRecipeContext,
  onSelect,
  readOnly,
  recipe,
  selected,
}: LayoutEditorRecipeRowProps) {
  const metadata = getRecipeMetadata(recipe);
  const isComposite = isCompositeRecipe(recipe);
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
      } ${dropPlacement ? `layout-editor-row--drop-${dropPlacement}` : ""} ${
        readOnly ? "layout-editor-row--readonly" : ""
      }`}
      data-layout-editor-entry={entry.id}
    >
      <span
        className="layout-editor-row__index"
        data-tooltip={readOnly ? "Read-only order" : "Drag to reorder"}
        onPointerDown={(event) => {
          if (readOnly) {
            return;
          }

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
      <label className="layout-editor-row__size" data-tooltip="Production size">
        <span aria-hidden="true">×</span>
        <input
          aria-label={`${metadata.name} production size`}
          inputMode="decimal"
          min="0.000001"
          step="any"
          type="number"
          disabled={readOnly}
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
      {readOnly ? (
        <span className="layout-editor-row__remove layout-editor-row__remove--blank" />
      ) : (
        <button
          aria-label={`Remove ${metadata.name} from layout`}
          className="layout-editor-row__remove"
          data-tooltip="Remove recipe"
          type="button"
          onClick={onRemove}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

interface LayoutRecipeInspectorProps {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry | null;
  getFocusedLayoutRecipeCount(recipeId: string): number;
  onAddRecipeToLayout?(recipeId: string): void;
  relatedRecipeContext: InspectorRelatedRecipeContext | null;
  relatedRecipeFlagFilters: InspectorRecipeFlagFilters;
  recipe: RecipePrototype | null;
  onRelatedRecipeContextChange(context: InspectorRelatedRecipeContext): void;
  onRelatedRecipeFlagFiltersChange(filters: InspectorRecipeFlagFilters): void;
  onOpenRecipeContext(itemId: string): void;
}

function LayoutRecipeInspector({
  data,
  entry,
  getFocusedLayoutRecipeCount,
  onAddRecipeToLayout,
  onRelatedRecipeContextChange,
  onRelatedRecipeFlagFiltersChange,
  onOpenRecipeContext,
  relatedRecipeContext,
  relatedRecipeFlagFilters,
  recipe,
}: LayoutRecipeInspectorProps) {
  if (!entry || !recipe) {
    return (
      <aside
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
  const openContextItemId = relatedRecipeContext?.itemId ?? contextItemId;
  const tags = [
    ...metadata.flags,
    ...metadata.disallowedEffects.map((effect) => `no ${effect}`),
  ];
  const isComposite = isCompositeRecipe(recipe);

  if (isComposite) {
    return (
      <aside
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
            relatedRecipeContext={relatedRecipeContext}
            relatedVariant="made-by"
            onSelectRelatedRecipeContext={onRelatedRecipeContextChange}
          />
          <ArrowRight size={18} aria-hidden="true" />
          <InspectorMaterialGroup
            data={data}
            entries={recipe.results ?? []}
            label="Outputs"
            relatedRecipeContext={relatedRecipeContext}
            relatedVariant="used-in"
            onSelectRelatedRecipeContext={onRelatedRecipeContextChange}
          />
        </div>

        <button
          className="layout-inspector__open primary-action-button"
          disabled={!openContextItemId}
          type="button"
          onClick={() => {
            if (openContextItemId) {
              onOpenRecipeContext(openContextItemId);
            }
          }}
        >
          <ExternalLink size={17} aria-hidden="true" />
          Open in Recipes
        </button>
        <InspectorRelatedRecipes
          context={relatedRecipeContext}
          data={data}
          filters={relatedRecipeFlagFilters}
          getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
          onFiltersChange={onRelatedRecipeFlagFiltersChange}
          {...(onAddRecipeToLayout ? { onAddRecipeToLayout } : {})}
        />
      </aside>
    );
  }

  return (
    <aside
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
        producerIds={[]}
      />

      <div className="layout-inspector__equation">
        <InspectorMaterialGroup
          data={data}
          entries={recipe.ingredients ?? []}
          label="Ingredients"
          relatedRecipeContext={relatedRecipeContext}
          relatedVariant="made-by"
          onSelectRelatedRecipeContext={onRelatedRecipeContextChange}
        />
        <ArrowRight size={18} aria-hidden="true" />
        <InspectorMaterialGroup
          data={data}
          entries={recipe.results ?? []}
          label="Results"
          relatedRecipeContext={relatedRecipeContext}
          relatedVariant="used-in"
          onSelectRelatedRecipeContext={onRelatedRecipeContextChange}
        />
      </div>

      {tags.length ? (
        <div className="layout-inspector__tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <button
        className="layout-inspector__open primary-action-button"
        disabled={!openContextItemId}
        type="button"
        onClick={() => {
          if (openContextItemId) {
            onOpenRecipeContext(openContextItemId);
          }
        }}
      >
        <ExternalLink size={17} aria-hidden="true" />
        Open in Recipes
      </button>
      <InspectorRelatedRecipes
        context={relatedRecipeContext}
        data={data}
        filters={relatedRecipeFlagFilters}
        getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
        onFiltersChange={onRelatedRecipeFlagFiltersChange}
        {...(onAddRecipeToLayout ? { onAddRecipeToLayout } : {})}
      />
    </aside>
  );
}

type InspectorRelatedRecipeVariant = "made-by" | "used-in";

interface InspectorRelatedRecipeContext {
  itemId: string;
  itemName: string;
  variant: InspectorRelatedRecipeVariant;
}

interface InspectorRecipeFlagFilters {
  includeLocked: boolean;
  includeMining: boolean;
  includeRecycling: boolean;
  includeTechnology: boolean;
}

const defaultInspectorRecipeFlagFilters: InspectorRecipeFlagFilters = {
  includeLocked: true,
  includeMining: true,
  includeRecycling: false,
  includeTechnology: false,
};

interface InspectorMaterialGroupProps {
  data: RecipeExplorerData;
  entries: readonly (IngredientPrototype | ProductPrototype)[];
  label: string;
  relatedRecipeContext?: InspectorRelatedRecipeContext | null;
  relatedVariant?: InspectorRelatedRecipeVariant;
  onSelectRelatedRecipeContext?(context: InspectorRelatedRecipeContext): void;
}

function InspectorMaterialGroup({
  data,
  entries,
  label,
  onSelectRelatedRecipeContext,
  relatedRecipeContext,
  relatedVariant,
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
              isSelected={
                relatedRecipeContext?.itemId === entry.name &&
                relatedRecipeContext.variant === relatedVariant
              }
              key={`${materialKey(entry)}:${index}`}
              {...(relatedVariant && onSelectRelatedRecipeContext
                ? {
                    relatedVariant,
                    onSelectRelatedRecipeContext,
                  }
                : {})}
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
  isSelected: boolean;
  relatedVariant?: InspectorRelatedRecipeVariant;
  onSelectRelatedRecipeContext?(context: InspectorRelatedRecipeContext): void;
}

function InspectorMaterial({
  data,
  entry,
  isSelected,
  onSelectRelatedRecipeContext,
  relatedVariant,
}: InspectorMaterialProps) {
  const item = data.itemById.get(entry.name);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : entry.name);
  const label = item?.name ?? formatId(entry.name);
  const content = (
    <>
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
      <span>
        <strong>{label}</strong>
        <small>{entry.name}</small>
      </span>
      <em>{formatMaterialAmount(entry)}</em>
    </>
  );

  if (!item || !relatedVariant || !onSelectRelatedRecipeContext) {
    return <li className="layout-inspector__material">{content}</li>;
  }

  return (
    <li className="layout-inspector__material-item">
      <button
        aria-label={`${relatedVariant === "made-by" ? "Show producers for" : "Show consumers for"} ${label}`}
        aria-pressed={isSelected}
        className={`layout-inspector__material layout-inspector__material--button ${
          isSelected ? "layout-inspector__material--selected" : ""
        }`}
        type="button"
        onClick={() =>
          onSelectRelatedRecipeContext({
            itemId: item.id,
            itemName: item.name,
            variant: relatedVariant,
          })
        }
      >
        {content}
      </button>
    </li>
  );
}

interface InspectorRelatedRecipesProps {
  context: InspectorRelatedRecipeContext | null;
  data: RecipeExplorerData;
  filters: InspectorRecipeFlagFilters;
  getFocusedLayoutRecipeCount(recipeId: string): number;
  onFiltersChange(filters: InspectorRecipeFlagFilters): void;
  onAddRecipeToLayout?(recipeId: string): void;
}

function InspectorRelatedRecipes({
  context,
  data,
  filters,
  getFocusedLayoutRecipeCount,
  onFiltersChange,
  onAddRecipeToLayout,
}: InspectorRelatedRecipesProps) {
  if (!context) {
    return null;
  }

  const recipes = (
    context.variant === "made-by"
      ? data.madeBy(context.itemId)
      : data.usedIn(context.itemId)
  ).filter((recipe) => recipeMatchesInspectorFlagFilters(recipe, filters));
  const title = context.variant === "made-by" ? "Made by" : "Used in";

  return (
    <div
      className="layout-inspector__related"
      aria-label={`${title} recipes for ${context.itemName}`}
    >
      <InspectorRecipeFlagFilterControls
        filters={filters}
        onChange={onFiltersChange}
      />
      <RecipeColumn
        data={data}
        getFocusedLayoutRecipeCount={getFocusedLayoutRecipeCount}
        recipes={recipes}
        selectedItemId={context.itemId}
        title={title}
        variant={context.variant}
        {...(onAddRecipeToLayout ? { onAddRecipeToLayout } : {})}
      />
    </div>
  );
}

interface InspectorRecipeFlagFiltersProps {
  filters: InspectorRecipeFlagFilters;
  onChange(filters: InspectorRecipeFlagFilters): void;
}

function InspectorRecipeFlagFilterControls({
  filters,
  onChange,
}: InspectorRecipeFlagFiltersProps) {
  return (
    <div
      className="layout-inspector__flag-filters"
      role="group"
      aria-label="Related recipe flag filters"
    >
      <InspectorRecipeFlagToggle
        checked={filters.includeLocked}
        icon={<Lock size={15} aria-hidden="true" />}
        label="Locked"
        onChange={(includeLocked) => onChange({ ...filters, includeLocked })}
      />
      <InspectorRecipeFlagToggle
        checked={filters.includeMining}
        icon={<Pickaxe size={15} aria-hidden="true" />}
        label="Mining"
        onChange={(includeMining) => onChange({ ...filters, includeMining })}
      />
      <InspectorRecipeFlagToggle
        checked={filters.includeRecycling}
        icon={<Recycle size={15} aria-hidden="true" />}
        label="Recycling"
        onChange={(includeRecycling) => onChange({ ...filters, includeRecycling })}
      />
      <InspectorRecipeFlagToggle
        checked={filters.includeTechnology}
        icon={<FlaskConical size={15} aria-hidden="true" />}
        label="Technology"
        onChange={(includeTechnology) => onChange({ ...filters, includeTechnology })}
      />
    </div>
  );
}

interface InspectorRecipeFlagToggleProps {
  checked: boolean;
  icon: ReactNode;
  label: string;
  onChange(checked: boolean): void;
}

function InspectorRecipeFlagToggle({
  checked,
  icon,
  label,
  onChange,
}: InspectorRecipeFlagToggleProps) {
  return (
    <label className="layout-inspector__flag-toggle">
      <input
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="layout-inspector__flag-toggle-icon">{icon}</span>
      <span>{label}</span>
    </label>
  );
}

function recipeMatchesInspectorFlagFilters(
  recipe: RecipePrototype,
  filters: InspectorRecipeFlagFilters,
): boolean {
  const metadata = getRecipeMetadata(recipe);

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
