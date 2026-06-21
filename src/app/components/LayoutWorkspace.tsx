import {
  Boxes,
  CircleDot,
  GripVertical,
  Network,
  PackageOpen,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { RecipePrototype } from "../../factorio/prototypes";
import {
  getRecipeIconId,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import type {
  LayoutReorderPlacement,
  RecipeLayout,
  RecipeLayoutEntry,
} from "../types";
import { IconSprite } from "./IconSprite";

interface LayoutWorkspaceProps {
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  onCreateLayout(): void;
  onDeleteLayout(layoutId: string): void;
  onFocusLayout(layoutId: string): void;
  onImportLayout(layoutId: string, file: File): void;
  onOpenLayoutGraph(layoutId: string): void;
  onRecipeProductionSizeChange(
    layoutId: string,
    entryId: string,
    productionSize: number,
  ): void;
  onRemoveRecipeFromLayout(layoutId: string, entryId: string): void;
  onRenameLayout(layoutId: string, name: string): void;
  onReorderLayout(
    sourceLayoutId: string,
    targetLayoutId: string,
    placement: LayoutReorderPlacement,
  ): void;
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
  onFocusLayout,
  onImportLayout,
  onOpenLayoutGraph,
  onRecipeProductionSizeChange,
  onRemoveRecipeFromLayout,
  onRenameLayout,
  onReorderLayout,
  onReorderRecipeInLayout,
  onSelectItem,
}: LayoutWorkspaceProps) {
  const [draggedLayoutId, setDraggedLayoutId] = useState<string | null>(null);
  const [layoutDropTarget, setLayoutDropTarget] = useState<{
    layoutId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [entryDropTarget, setEntryDropTarget] = useState<{
    entryId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const focusedLayout =
    layouts.find((layout) => layout.id === focusedLayoutId) ?? layouts[0] ?? null;
  const title = focusedLayout?.name.trim() || "Untitled layout";

  useEffect(() => {
    if (!draggedLayoutId) {
      return;
    }

    const activeLayoutId = draggedLayoutId;

    function handlePointerMove(event: PointerEvent) {
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-layout-editor-row]");
      const targetLayoutId = row?.dataset.layoutEditorRow;

      if (!row || !targetLayoutId || targetLayoutId === activeLayoutId) {
        setLayoutDropTarget(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      const placement: LayoutReorderPlacement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";

      setLayoutDropTarget({ layoutId: targetLayoutId, placement });
    }

    function handlePointerUp() {
      if (layoutDropTarget) {
        onReorderLayout(
          activeLayoutId,
          layoutDropTarget.layoutId,
          layoutDropTarget.placement,
        );
      }

      setDraggedLayoutId(null);
      setLayoutDropTarget(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedLayoutId, layoutDropTarget, onReorderLayout]);

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

  return (
    <section className="layout-workspace">
      <header className="layout-workspace__header app-panel">
        <div className="layout-workspace__title">
          <Boxes size={28} aria-hidden="true" />
          <div>
            <h1>{title}</h1>
            <span>
              {focusedLayout.entries.length}{" "}
              {focusedLayout.entries.length === 1 ? "recipe" : "recipes"}
            </span>
          </div>
        </div>
        <div className="layout-workspace__actions">
          <button
            aria-label="Create layout"
            className="icon-button"
            data-tooltip="Create layout"
            type="button"
            onClick={onCreateLayout}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          {!focusedLayout.entries.length ? (
            <>
              <button
                aria-label="Import layout"
                className="icon-button"
                data-tooltip="Import layout"
                type="button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={18} aria-hidden="true" />
              </button>
              <input
                accept="application/json,.json"
                aria-label="Import layout file"
                className="layout-card__import-input"
                ref={importInputRef}
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    onImportLayout(focusedLayout.id, file);
                  }

                  event.currentTarget.value = "";
                }}
              />
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
            <button
              aria-label="Open layout graph"
              className="icon-button"
              data-tooltip="Open graph"
              type="button"
              onClick={() => onOpenLayoutGraph(focusedLayout.id)}
            >
              <Network size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="layout-workspace__body">
        <aside className="layout-workspace__rail app-panel" aria-label="Layout list">
          <div className="layout-workspace__rail-header">
            <span>Layouts</span>
            <button
              aria-label="Create layout"
              className="layout-action-button"
              data-tooltip="Create layout"
              type="button"
              onClick={onCreateLayout}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="layout-workspace__rail-list">
            {layouts.map((layout) => (
              <div
                className={`layout-workspace__rail-row ${
                  layout.id === focusedLayout.id
                    ? "layout-workspace__rail-row--focused"
                    : ""
                } ${
                  draggedLayoutId === layout.id
                    ? "layout-workspace__rail-row--dragging"
                    : ""
                } ${
                  layoutDropTarget?.layoutId === layout.id
                    ? `layout-workspace__rail-row--drop-${layoutDropTarget.placement}`
                    : ""
                }`}
                data-layout-editor-row={layout.id}
                key={layout.id}
              >
                <button
                  aria-label={`Reorder ${layout.name.trim() || "Untitled layout"}`}
                  className="layout-workspace__drag-button"
                  data-tooltip="Drag to reorder"
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onFocusLayout(layout.id);
                    setDraggedLayoutId(layout.id);
                    setLayoutDropTarget(null);
                  }}
                >
                  <GripVertical size={15} aria-hidden="true" />
                </button>
                <button
                  aria-label={`Focus ${layout.name.trim() || "Untitled layout"}`}
                  aria-pressed={layout.id === focusedLayout.id}
                  className="layout-workspace__rail-main"
                  type="button"
                  onClick={() => onFocusLayout(layout.id)}
                >
                  <CircleDot size={14} aria-hidden="true" />
                  <span>{layout.name.trim() || "Untitled layout"}</span>
                  <small>{layout.entries.length}</small>
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="layout-editor app-panel" aria-label="Focused layout editor">
          <div className="layout-editor__name-row">
            <label>
              <span>Layout name</span>
              <input
                aria-label="Layout name"
                placeholder="Untitled layout"
                value={focusedLayout.name}
                onChange={(event) => onRenameLayout(focusedLayout.id, event.target.value)}
              />
            </label>
          </div>

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
                    onRemove={() => onRemoveRecipeFromLayout(focusedLayout.id, entry.id)}
                    onSelectItem={onSelectItem}
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
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload size={18} aria-hidden="true" />
                  Import layout
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

interface LayoutEditorRecipeRowProps {
  data: RecipeExplorerData;
  dragging: boolean;
  dropPlacement: LayoutReorderPlacement | null;
  entry: RecipeLayoutEntry;
  index: number;
  recipe: RecipePrototype;
  onDragStart(): void;
  onProductionSizeChange(productionSize: number): void;
  onRemove(): void;
  onSelectItem(itemId: string): void;
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
  onSelectItem,
  recipe,
}: LayoutEditorRecipeRowProps) {
  const metadata = getRecipeMetadata(recipe);
  const icon = data.iconById.get(getRecipeIconId(recipe));
  const contextItemId = getRecipeContextItemId(data, recipe);
  const [productionSizeDraft, setProductionSizeDraft] = useState(
    formatProductionSize(entry.productionSize),
  );

  useEffect(() => {
    setProductionSizeDraft(formatProductionSize(entry.productionSize));
  }, [entry.productionSize]);

  return (
    <div
      className={`layout-editor-row ${dragging ? "layout-editor-row--dragging" : ""} ${
        dropPlacement ? `layout-editor-row--drop-${dropPlacement}` : ""
      }`}
      data-layout-editor-entry={entry.id}
    >
      <button
        aria-label={`Reorder ${metadata.name}`}
        className="layout-editor-row__drag"
        data-tooltip="Drag to reorder"
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
      >
        <span>{index + 1}</span>
      </button>
      <button
        className="layout-editor-row__recipe"
        data-tooltip={`${metadata.name} (${metadata.id})`}
        type="button"
        onClick={() => {
          if (contextItemId) {
            onSelectItem(contextItemId);
          }
        }}
      >
        <IconSprite atlas={data.atlas} icon={icon} label={metadata.name} size={32} />
        <span>
          <strong>{metadata.name}</strong>
          <small>{metadata.id}</small>
        </span>
      </button>
      <label className="layout-editor-row__size" data-tooltip="Production size">
        <span>Size</span>
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
