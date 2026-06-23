import {
  BookOpen,
  BookMarked,
  BookmarkMinus,
  Boxes,
  Cog,
  Import,
  ListPlus,
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
import type {
  FactorioLabCategory,
  FactorioLabIcon,
  FactorioLabItem,
} from "../../factoriolab/types";
import type { RecipePrototype } from "../../factorio/prototypes";
import {
  getCompositeRecipeIconIds,
  getRecipeLayoutTitle,
  inferLayoutCompositeBoundary,
} from "../composite-recipes";
import {
  getIconIdForItem,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import type {
  AppView,
  InstalledLayoutRecipe,
  LayoutReorderPlacement,
  RecipeLayout,
} from "../types";
import { IconSprite } from "./IconSprite";
import { CompositeRecipeIcon, RecipeIcon } from "./RecipeIcon";
import { LayoutImportDialog } from "./LayoutStringDialogs";

interface AppSidebarProps {
  activeView: AppView;
  data: RecipeExplorerData;
  focusedLayoutId: string;
  installedRecipes: InstalledLayoutRecipe[];
  layouts: RecipeLayout[];
  selectedItemId: string | null;
  getInstalledRecipeReferenceCount(recipeId: string): number;
  onAddInstalledRecipeToLayout(recipeId: string): void;
  onCreateLayout(): void;
  onFocusLayout(layoutId: string): void;
  onImportLayout(value: string): boolean;
  onInstalledRecipeUnload(recipeId: string): void;
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
  getInstalledRecipeReferenceCount,
  installedRecipes,
  layouts,
  onAddInstalledRecipeToLayout,
  selectedItemId,
  onCreateLayout,
  onFocusLayout,
  onImportLayout,
  onInstalledRecipeUnload,
  onOpenLayoutGraph,
  onReorderLayout,
  onSelectItem,
  onViewChange,
}: AppSidebarProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(selectedItemId === null);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
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

      <section className="sidebar-section sidebar-installed" aria-label="Installed">
        <div className="sidebar-section__header">
          <span className="sidebar-section__title">
            <BookMarked size={18} aria-hidden="true" />
            <span>Installed</span>
          </span>
        </div>

        <div className="sidebar-installed-list">
          {installedRecipes.length ? (
            installedRecipes.map((installedRecipe) => {
              const recipe = data.recipeById.get(installedRecipe.id);

              if (!recipe) {
                return null;
              }

              const metadata = getRecipeMetadata(recipe);
              const contextItemId = getRecipeContextItemId(data, recipe);
              const referenceCount = getInstalledRecipeReferenceCount(installedRecipe.id);

              return (
                <div className="sidebar-installed-row" key={installedRecipe.id}>
                  <button
                    aria-label={`Open ${metadata.name} recipe context`}
                    className="sidebar-installed-row__main"
                    disabled={!contextItemId}
                    type="button"
                    onClick={() => {
                      if (contextItemId) {
                        onSelectItem(contextItemId);
                      }
                    }}
                  >
                    <RecipeIcon data={data} recipe={recipe} size={26} />
                    <span>
                      <strong>{metadata.name}</strong>
                      <small>
                        {recipe.ingredients?.length ?? 0} in /{" "}
                        {recipe.results?.length ?? 0} out
                      </small>
                    </span>
                  </button>
                  <button
                    aria-label={`Add ${metadata.name} to focused layout`}
                    className="layout-action-button"
                    data-tooltip="Add to layout"
                    type="button"
                    onClick={() => onAddInstalledRecipeToLayout(installedRecipe.id)}
                  >
                    <ListPlus size={15} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Unload ${metadata.name}`}
                    className="layout-action-button"
                    data-tooltip={
                      referenceCount
                        ? `Used by ${referenceCount} layout ${
                            referenceCount === 1 ? "entry" : "entries"
                          }`
                        : "Unload"
                    }
                    disabled={referenceCount > 0}
                    type="button"
                    onClick={() => onInstalledRecipeUnload(installedRecipe.id)}
                  >
                    <BookmarkMinus size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })
          ) : (
            <span className="sidebar-installed-empty">No installed layouts</span>
          )}
        </div>
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
          <div className="sidebar-section__actions">
            <button
              aria-label="Import layout"
              className="icon-button"
              data-tooltip="Import layout"
              type="button"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Import size={18} aria-hidden="true" />
            </button>
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
        </div>

        <div className="sidebar-layout-list">
          {layouts.map((layout) => {
            const layoutTitle = getRecipeLayoutTitle(data, layout);
            const iconEntries = getLayoutCompositeIconEntries(data, layout);

            return (
              <div
                className={`sidebar-layout-row ${
                  layout.id === focusedLayoutId ? "sidebar-layout-row--focused" : ""
                } ${
                  draggedLayoutId === layout.id ? "sidebar-layout-row--dragging" : ""
                } ${
                  layoutDropTarget?.layoutId === layout.id
                    ? `sidebar-layout-row--drop-${layoutDropTarget.placement}`
                    : ""
                }`}
                data-sidebar-layout-row={layout.id}
                key={layout.id}
              >
                <button
                  aria-label={`Focus ${layoutTitle}`}
                  aria-pressed={layout.id === focusedLayoutId}
                  className="sidebar-layout-row__main"
                  type="button"
                  onClick={() => {
                    onFocusLayout(layout.id);
                    onViewChange("layouts");
                  }}
                >
                  <span
                    className="sidebar-layout-row__icon"
                    data-tooltip="Drag to reorder"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      onFocusLayout(layout.id);
                      setDraggedLayoutId(layout.id);
                      setLayoutDropTarget(null);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CompositeRecipeIcon
                      atlas={data.atlas}
                      icons={iconEntries}
                      label={`${layoutTitle} icon`}
                      size={28}
                    />
                  </span>
                  <span className="sidebar-layout-row__title">{layoutTitle}</span>
                  <small>{layout.entries.length}</small>
                </button>
                <button
                  aria-label={`Open ${layoutTitle} graph`}
                  className="layout-action-button"
                  data-tooltip="Open graph"
                  type="button"
                  onClick={() => onOpenLayoutGraph(layout.id)}
                >
                  <Network size={15} aria-hidden="true" />
                </button>
              </div>
            );
          })}
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

      {isImportDialogOpen ? (
        <LayoutImportDialog
          onClose={() => setIsImportDialogOpen(false)}
          onImport={onImportLayout}
        />
      ) : null}
    </aside>
  );
}

interface ItemCategoryGroup {
  category: FactorioLabCategory;
  items: FactorioLabItem[];
}

function getLayoutCompositeIconEntries(
  data: RecipeExplorerData,
  layout: RecipeLayout,
): Array<{ icon: FactorioLabIcon | undefined; label: string }> {
  const boundary = inferLayoutCompositeBoundary(layout, data.recipeById);
  const iconIds = getCompositeRecipeIconIds(
    data,
    boundary.results,
    layout.iconIds,
    layout.hiddenIconIds,
  );

  return iconIds.map((iconId) => ({
    icon: data.iconById.get(iconId),
    label: data.itemById.get(iconId)?.name ?? formatId(iconId),
  }));
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

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
