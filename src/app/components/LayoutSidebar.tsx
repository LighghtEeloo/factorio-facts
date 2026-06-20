import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cog,
  Maximize2,
  Minimize2,
  Network,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import type { FactorioLabCategory, FactorioLabItem } from "../../factoriolab/types";
import {
  getIconIdForItem,
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

interface LayoutSidebarProps {
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  selectedItemId: string | null;
  onCreateLayout(): void;
  onDeleteLayout(layoutId: string): void;
  onFocusLayout(layoutId: string): void;
  onImportLayout(layoutId: string, file: File): void;
  onOpenLayoutGraph(layoutId: string): void;
  onRemoveRecipeFromLayout(layoutId: string, entryId: string): void;
  onRecipeProductionSizeChange(
    layoutId: string,
    entryId: string,
    productionSize: number,
  ): void;
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
  onSelect(itemId: string): void;
  onToggleLayoutCollapsed(layoutId: string): void;
}

export function LayoutSidebar({
  data,
  focusedLayoutId,
  layouts,
  selectedItemId,
  onCreateLayout,
  onDeleteLayout,
  onFocusLayout,
  onImportLayout,
  onOpenLayoutGraph,
  onRemoveRecipeFromLayout,
  onRecipeProductionSizeChange,
  onRenameLayout,
  onReorderLayout,
  onReorderRecipeInLayout,
  onSelect,
  onToggleLayoutCollapsed,
}: LayoutSidebarProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(selectedItemId === null);
  const [isSelectorFullscreen, setIsSelectorFullscreen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [draggedLayoutId, setDraggedLayoutId] = useState<string | null>(null);
  const [layoutDropTarget, setLayoutDropTarget] = useState<{
    layoutId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const selectorSearchRef = useRef<HTMLInputElement | null>(null);
  const selectorGroups = useMemo(
    () => groupItemsByCategory(data, searchItems(data.items, selectorQuery)),
    [data, selectorQuery],
  );

  useEffect(() => {
    if (selectedItemId === null) {
      setIsSelectorOpen(true);
    }
  }, [selectedItemId]);

  useEffect(() => {
    if (!isSelectorOpen) {
      return;
    }

    setSelectorQuery("");
    requestAnimationFrame(() => selectorSearchRef.current?.focus());
  }, [isSelectorOpen]);

  useEffect(() => {
    if (!isSelectorOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSelectorOpen(false);
        setIsSelectorFullscreen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSelectorOpen]);

  useEffect(() => {
    if (!draggedLayoutId) {
      return;
    }

    const activeLayoutId = draggedLayoutId;

    function handlePointerMove(event: PointerEvent) {
      const card = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-layout-card]");
      const targetLayoutId = card?.dataset.layoutCard;

      if (!card || !targetLayoutId || targetLayoutId === activeLayoutId) {
        setLayoutDropTarget(null);
        return;
      }

      const rect = card.getBoundingClientRect();
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

      endLayoutDrag();
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedLayoutId, layoutDropTarget, onReorderLayout]);

  function selectFromPicker(itemId: string) {
    onSelect(itemId);
    setIsSelectorOpen(false);
    setIsSelectorFullscreen(false);
    setSelectorQuery("");
  }

  function endLayoutDrag() {
    setDraggedLayoutId(null);
    setLayoutDropTarget(null);
  }

  return (
    <aside className="sidebar app-panel">
      <div className="brand-mark">
        <span className="brand-mark__label">
          <Cog size={20} aria-hidden="true" />
          <span>Factorio Facts</span>
        </span>
        <button
          aria-label="Open item selector"
          className="icon-button item-selector-button"
          data-tooltip="Open item selector"
          type="button"
          onClick={() => setIsSelectorOpen(true)}
        >
          <Package size={18} aria-hidden="true" />
        </button>
      </div>

      <section className="layout-panel" aria-label="Layouts">
        <div className="layout-panel__header">
          <span>Layouts</span>
          <button
            aria-label="Create layout"
            className="icon-button"
            data-tooltip="Create layout"
            type="button"
            onClick={onCreateLayout}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="layout-list">
          {layouts.map((layout) => (
            <LayoutCard
              data={data}
              focused={layout.id === focusedLayoutId}
              dragging={draggedLayoutId === layout.id}
              dropPlacement={
                layoutDropTarget?.layoutId === layout.id
                  ? layoutDropTarget.placement
                  : null
              }
              key={layout.id}
              layout={layout}
              onDeleteLayout={onDeleteLayout}
              onFocusLayout={onFocusLayout}
              onImportLayout={onImportLayout}
              onLayoutDragStart={() => {
                onFocusLayout(layout.id);
                setDraggedLayoutId(layout.id);
                setLayoutDropTarget(null);
              }}
              onOpenLayoutGraph={onOpenLayoutGraph}
              onRecipeProductionSizeChange={onRecipeProductionSizeChange}
              onRemoveRecipeFromLayout={onRemoveRecipeFromLayout}
              onRenameLayout={onRenameLayout}
              onReorderRecipeInLayout={onReorderRecipeInLayout}
              onSelectItem={onSelect}
              onToggleLayoutCollapsed={onToggleLayoutCollapsed}
            />
          ))}
        </div>
      </section>

      {isSelectorOpen ? (
        <div
          className={`item-selector-backdrop ${isSelectorFullscreen ? "popup-backdrop--fullscreen" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSelectorOpen(false);
              setIsSelectorFullscreen(false);
            }
          }}
        >
          <section
            aria-labelledby="item-selector-title"
            aria-modal="true"
            className={`item-selector app-panel ${isSelectorFullscreen ? "popup-dialog--fullscreen" : ""}`}
            role="dialog"
          >
            <header className="item-selector__header">
              <h2 id="item-selector-title">Select item</h2>
              <div className="popup-header-actions">
                <button
                  aria-label={
                    isSelectorFullscreen
                      ? "Exit fullscreen item selector"
                      : "Fullscreen item selector"
                  }
                  aria-pressed={isSelectorFullscreen}
                  className="icon-button"
                  data-tooltip={isSelectorFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  type="button"
                  onClick={() => setIsSelectorFullscreen((current) => !current)}
                >
                  {isSelectorFullscreen ? (
                    <Minimize2 size={18} aria-hidden="true" />
                  ) : (
                    <Maximize2 size={18} aria-hidden="true" />
                  )}
                </button>
                <button
                  aria-label="Close item selector"
                  className="icon-button"
                  data-tooltip="Close"
                  type="button"
                  onClick={() => {
                    setIsSelectorOpen(false);
                    setIsSelectorFullscreen(false);
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="search-box item-selector__search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search selector items and fluids"
                autoComplete="off"
                placeholder="Search items"
                ref={selectorSearchRef}
                value={selectorQuery}
                onChange={(event) => setSelectorQuery(event.target.value)}
              />
            </div>

            <div className="item-selector__content">
              {selectorGroups.length ? (
                selectorGroups.map((group) => (
                  <section className="item-selector__group" key={group.category.id}>
                    <h3>
                      <IconSprite
                        atlas={data.atlas}
                        icon={data.iconById.get(group.category.icon ?? group.category.id)}
                        label={group.category.name}
                        size={20}
                      />
                      {group.category.name}
                    </h3>
                    <div className="item-selector__grid">
                      {group.items.map((item) => {
                        const icon = data.iconById.get(getIconIdForItem(item));

                        return (
                          <button
                            aria-label={item.name}
                            className={`item-selector__item ${item.id === selectedItemId ? "item-selector__item--selected" : ""}`}
                            data-tooltip={`${item.name} (${item.id})`}
                            key={item.id}
                            type="button"
                            onClick={() => selectFromPicker(item.id)}
                          >
                            <IconSprite
                              atlas={data.atlas}
                              icon={icon}
                              label={item.name}
                              size={30}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="empty-state">No items found</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}

interface LayoutCardProps {
  data: RecipeExplorerData;
  dragging: boolean;
  dropPlacement: LayoutReorderPlacement | null;
  focused: boolean;
  layout: RecipeLayout;
  onDeleteLayout(layoutId: string): void;
  onFocusLayout(layoutId: string): void;
  onImportLayout(layoutId: string, file: File): void;
  onLayoutDragStart(): void;
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
  onToggleLayoutCollapsed(layoutId: string): void;
}

function LayoutCard({
  data,
  dragging,
  dropPlacement,
  focused,
  layout,
  onDeleteLayout,
  onFocusLayout,
  onImportLayout,
  onLayoutDragStart,
  onOpenLayoutGraph,
  onRecipeProductionSizeChange,
  onRemoveRecipeFromLayout,
  onRenameLayout,
  onReorderRecipeInLayout,
  onSelectItem,
  onToggleLayoutCollapsed,
}: LayoutCardProps) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    entryId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!draggedEntryId) {
      return;
    }

    const activeEntryId = draggedEntryId;

    function handlePointerMove(event: PointerEvent) {
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-layout-entry-row]");
      const targetEntryId = row?.dataset.layoutEntryRow;

      if (!row || !targetEntryId || targetEntryId === activeEntryId) {
        setDropTarget(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      const placement: LayoutReorderPlacement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";

      setDropTarget({ entryId: targetEntryId, placement });
    }

    function handlePointerUp() {
      if (dropTarget) {
        onReorderRecipeInLayout(
          layout.id,
          activeEntryId,
          dropTarget.entryId,
          dropTarget.placement,
        );
      }

      endRecipeDrag();
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedEntryId, dropTarget, layout.id, onReorderRecipeInLayout]);

  function endRecipeDrag() {
    setDraggedEntryId(null);
    setDropTarget(null);
  }

  return (
    <article
      className={`layout-card ${focused ? "layout-card--focused" : ""} ${
        dragging ? "layout-card--dragging" : ""
      } ${dropPlacement ? `layout-card--drop-${dropPlacement}` : ""}`}
      data-layout-card={layout.id}
    >
      <div className="layout-card__header">
        <button
          aria-label="Focus layout"
          aria-pressed={focused}
          className="layout-card__focus-button"
          data-tooltip={focused ? "Focused; drag to reorder" : "Focus or drag to reorder"}
          type="button"
          onClick={() => onFocusLayout(layout.id)}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onLayoutDragStart();
          }}
        >
          <CircleDot size={15} aria-hidden="true" />
        </button>
        <input
          aria-label="Layout name"
          className="layout-card__name"
          placeholder="Untitled layout"
          value={layout.name}
          onChange={(event) => onRenameLayout(layout.id, event.target.value)}
          onFocus={() => onFocusLayout(layout.id)}
        />
        <button
          aria-label={layout.collapsed ? "Expand layout recipes" : "Collapse layout recipes"}
          className="layout-card__collapse"
          data-tooltip={layout.collapsed ? "Expand recipes" : "Collapse recipes"}
          type="button"
          onClick={() => onToggleLayoutCollapsed(layout.id)}
        >
          {layout.collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>
        <div className="layout-card__actions">
          {layout.entries.length ? (
            <button
              aria-label="Open layout graph"
              className="layout-action-button"
              data-tooltip="Open graph"
              type="button"
              onClick={() => onOpenLayoutGraph(layout.id)}
            >
              <Network size={15} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                aria-label="Import layout"
                className="layout-action-button"
                data-tooltip="Import layout"
                type="button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={15} aria-hidden="true" />
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
                    onImportLayout(layout.id, file);
                  }

                  event.currentTarget.value = "";
                }}
              />
              <button
                aria-label="Delete layout"
                className="layout-action-button"
                data-tooltip="Delete layout"
                type="button"
                onClick={() => onDeleteLayout(layout.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {layout.collapsed ? null : (
        <div className="layout-card__recipes">
          {layout.entries.length ? (
            layout.entries.map((entry, index) => {
              const recipe = data.recipeById.get(entry.recipeId);

              if (!recipe) {
                return null;
              }

              return (
                <LayoutRecipeRow
                  data={data}
                  entry={entry}
                  index={index}
                  key={entry.id}
                  recipe={recipe}
                  dragging={draggedEntryId === entry.id}
                  dropPlacement={
                    dropTarget?.entryId === entry.id ? dropTarget.placement : null
                  }
                  onDragStart={() => {
                    setDraggedEntryId(entry.id);
                    setDropTarget(null);
                  }}
                  onProductionSizeChange={(productionSize) =>
                    onRecipeProductionSizeChange(layout.id, entry.id, productionSize)
                  }
                  onRemove={() => onRemoveRecipeFromLayout(layout.id, entry.id)}
                  onSelectItem={onSelectItem}
                />
              );
            })
          ) : (
            <div className="layout-card__empty">No recipes yet</div>
          )}
        </div>
      )}
    </article>
  );
}

interface LayoutRecipeRowProps {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry;
  index: number;
  recipe: RecipePrototype;
  dragging: boolean;
  dropPlacement: LayoutReorderPlacement | null;
  onDragStart(): void;
  onProductionSizeChange(productionSize: number): void;
  onRemove(): void;
  onSelectItem(itemId: string): void;
}

function LayoutRecipeRow({
  data,
  dragging,
  dropPlacement,
  entry,
  index,
  onDragStart,
  onProductionSizeChange,
  recipe,
  onRemove,
  onSelectItem,
}: LayoutRecipeRowProps) {
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
      className={`layout-recipe-row ${dragging ? "layout-recipe-row--dragging" : ""} ${
        dropPlacement ? `layout-recipe-row--drop-${dropPlacement}` : ""
      }`}
      data-layout-entry-row={entry.id}
    >
      <button
        aria-label={`Reorder ${metadata.name}`}
        className="layout-recipe-row__index"
        data-tooltip="Drag to reorder"
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
      >
        {index + 1}
      </button>
      <button
        className="layout-recipe-row__main"
        data-layout-entry={entry.id}
        data-tooltip={`${metadata.name} (${metadata.id})`}
        type="button"
        onClick={() => {
          if (contextItemId) {
            onSelectItem(contextItemId);
          }
        }}
      >
        <IconSprite atlas={data.atlas} icon={icon} label={metadata.name} size={24} />
        <span>{metadata.name}</span>
      </button>
      <label
        className="layout-recipe-row__size"
        data-tooltip="Production size"
      >
        <span>x</span>
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
        className="layout-recipe-row__remove"
        data-tooltip="Remove recipe"
        type="button"
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
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

interface ItemCategoryGroup {
  category: FactorioLabCategory;
  items: FactorioLabItem[];
}

function groupItemsByCategory(
  data: RecipeExplorerData,
  items: FactorioLabItem[],
): ItemCategoryGroup[] {
  const itemsByCategory = new Map<string, FactorioLabItem[]>();

  for (const item of items) {
    const categoryItems = itemsByCategory.get(item.category) ?? [];

    categoryItems.push(item);
    itemsByCategory.set(item.category, categoryItems);
  }

  return data.categories
    .map((category) => ({
      category,
      items: sortPickerItems(itemsByCategory.get(category.id) ?? []),
    }))
    .filter((group) => group.items.length > 0);
}

function sortPickerItems(items: FactorioLabItem[]): FactorioLabItem[] {
  return [...items].sort(
    (left, right) => left.row - right.row || left.name.localeCompare(right.name),
  );
}

function searchItems(items: FactorioLabItem[], query: string): FactorioLabItem[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return items;
  }

  return items
    .map((item) => ({ item, score: scoreItem(item, normalizedQuery) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name))
    .map((result) => result.item);
}

function scoreItem(item: FactorioLabItem, query: string): number {
  const name = normalize(item.name);
  const id = normalize(item.id);

  if (id === query || name === query) {
    return 1000;
  }

  if (name.startsWith(query) || id.startsWith(query)) {
    return 500;
  }

  const words = query.split(/\s+/).filter(Boolean);
  const wordScore = words.every((word) => name.includes(word) || id.includes(word))
    ? words.length * 100
    : 0;

  return wordScore || (name.includes(query) || id.includes(query) ? 50 : 0);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-");
}
