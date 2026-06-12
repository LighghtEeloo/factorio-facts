import { useEffect, useMemo, useRef, useState } from "react";
import { Cog, Package, Search, X } from "lucide-react";
import type { FactorioLabCategory, FactorioLabItem } from "../../factoriolab/types";
import {
  getIconIdForItem,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface ItemSearchProps {
  data: RecipeExplorerData;
  selectedItemId: string;
  onSelect(itemId: string): void;
}

export function ItemSearch({
  data,
  selectedItemId,
  onSelect,
}: ItemSearchProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState("");
  const selectorSearchRef = useRef<HTMLInputElement | null>(null);
  const selectorGroups = useMemo(
    () => groupItemsByCategory(data, searchItems(data.items, selectorQuery)),
    [data, selectorQuery],
  );

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

  function selectFromPicker(itemId: string) {
    onSelect(itemId);
    setIsSelectorOpen(false);
    setSelectorQuery("");
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

      {isSelectorOpen ? (
        <div
          className="item-selector-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSelectorOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="item-selector-title"
            aria-modal="true"
            className="item-selector app-panel"
            role="dialog"
          >
            <header className="item-selector__header">
              <h2 id="item-selector-title">Select item</h2>
              <button
                aria-label="Close item selector"
                className="icon-button"
                data-tooltip="Close"
                type="button"
                onClick={() => setIsSelectorOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
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
