import {
  BookOpen,
  Boxes,
  CircleDot,
  Cog,
  GripVertical,
  Network,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FactorioLabCategory, FactorioLabItem } from "../../factoriolab/types";
import {
  getIconIdForItem,
  type RecipeExplorerData,
} from "../data/factoriolab";
import type { AppView, LayoutReorderPlacement, RecipeLayout } from "../types";
import { IconSprite } from "./IconSprite";

interface AppSidebarProps {
  activeView: AppView;
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  selectedItemId: string | null;
  onCreateLayout(): void;
  onFocusLayout(layoutId: string): void;
  onOpenLayoutGraph(layoutId: string): void;
  onReorderLayout(
    sourceLayoutId: string,
    targetLayoutId: string,
    placement: LayoutReorderPlacement,
  ): void;
  onSelectItem(itemId: string): void;
  onViewChange(view: AppView): void;
}

export function AppSidebar({
  activeView,
  data,
  focusedLayoutId,
  layouts,
  selectedItemId,
  onCreateLayout,
  onFocusLayout,
  onOpenLayoutGraph,
  onReorderLayout,
  onSelectItem,
  onViewChange,
}: AppSidebarProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(selectedItemId === null);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [draggedLayoutId, setDraggedLayoutId] = useState<string | null>(null);
  const [layoutDropTarget, setLayoutDropTarget] = useState<{
    layoutId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const selectorSearchRef = useRef<HTMLInputElement | null>(null);
  const selectedItem = selectedItemId ? data.itemById.get(selectedItemId) ?? null : null;
  const selectedIcon = selectedItem
    ? data.iconById.get(getIconIdForItem(selectedItem))
    : undefined;
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
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-sidebar-layout-row]");
      const targetLayoutId = row?.dataset.sidebarLayoutRow;

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

  function selectFromPicker(itemId: string) {
    onSelectItem(itemId);
    setIsSelectorOpen(false);
    setSelectorQuery("");
  }

  return (
    <aside className="sidebar app-panel app-sidebar">
      <div className="brand-mark">
        <span className="brand-mark__label">
          <Cog size={20} aria-hidden="true" />
          <span>Factorio Facts</span>
        </span>
      </div>

      <section className="sidebar-section sidebar-recipes" aria-label="Recipes">
        <div className="sidebar-section__header">
          <span
            className={`sidebar-section__title ${
              activeView === "recipes" ? "sidebar-section__title--active" : ""
            }`}
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>Recipes</span>
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
        <button
          className="sidebar-context-button"
          type="button"
          onClick={() => {
            if (selectedItem) {
              onViewChange("recipes");
            } else {
              setIsSelectorOpen(true);
            }
          }}
        >
          {selectedItem ? (
            <>
              <IconSprite
                atlas={data.atlas}
                icon={selectedIcon}
                label={selectedItem.name}
                size={30}
              />
              <span>
                <strong>{selectedItem.name}</strong>
                <small>{selectedItem.id}</small>
              </span>
            </>
          ) : (
            <>
              <Search size={18} aria-hidden="true" />
              <span>
                <strong>Select item</strong>
                <small>No item selected</small>
              </span>
            </>
          )}
        </button>
      </section>

      <section className="sidebar-section sidebar-layouts" aria-label="Layouts">
        <div className="sidebar-section__header">
          <span
            className={`sidebar-section__title ${
              activeView === "layouts" || activeView === "graph"
                ? "sidebar-section__title--active"
                : ""
            }`}
          >
            <Boxes size={18} aria-hidden="true" />
            <span>Layouts</span>
          </span>
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

        <div className="sidebar-layout-list">
          {layouts.map((layout) => (
            <div
              className={`sidebar-layout-row ${
                layout.id === focusedLayoutId ? "sidebar-layout-row--focused" : ""
              } ${draggedLayoutId === layout.id ? "sidebar-layout-row--dragging" : ""} ${
                layoutDropTarget?.layoutId === layout.id
                  ? `sidebar-layout-row--drop-${layoutDropTarget.placement}`
                  : ""
              }`}
              data-sidebar-layout-row={layout.id}
              key={layout.id}
            >
              <button
                aria-label={`Reorder ${layout.name.trim() || "Untitled layout"}`}
                className="sidebar-layout-row__drag"
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
                <GripVertical size={14} aria-hidden="true" />
              </button>
              <button
                aria-label={`Focus ${layout.name.trim() || "Untitled layout"}`}
                aria-pressed={layout.id === focusedLayoutId}
                className="sidebar-layout-row__main"
                type="button"
                onClick={() => {
                  onFocusLayout(layout.id);
                  onViewChange("layouts");
                }}
              >
                <CircleDot size={14} aria-hidden="true" />
                <span>{layout.name.trim() || "Untitled layout"}</span>
                <small>{layout.entries.length}</small>
              </button>
              <button
                aria-label={`Open ${layout.name.trim() || "Untitled layout"} graph`}
                className="layout-action-button"
                data-tooltip="Open graph"
                type="button"
                onClick={() => onOpenLayoutGraph(layout.id)}
              >
                <Network size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {isSelectorOpen ? (
        <div
          className="item-selector-backdrop popup-backdrop--fullscreen"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSelectorOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="item-selector-title"
            aria-modal="true"
            className="item-selector app-panel popup-dialog--fullscreen"
            role="dialog"
          >
            <header className="item-selector__header">
              <h2 id="item-selector-title">Select item</h2>
              <div className="popup-header-actions">
                <button
                  aria-label="Close item selector"
                  className="icon-button"
                  data-tooltip="Close"
                  type="button"
                  onClick={() => setIsSelectorOpen(false)}
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
                            className={`item-selector__item ${
                              item.id === selectedItemId
                                ? "item-selector__item--selected"
                                : ""
                            }`}
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
    .sort(
      (left, right) =>
        right.score - left.score || left.item.name.localeCompare(right.item.name),
    )
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
