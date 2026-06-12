import { Cog, Droplets, Package, Search } from "lucide-react";
import type { FactorioLabItem } from "../../factoriolab/types";
import {
  getIconIdForItem,
  getItemKind,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface ItemSearchProps {
  data: RecipeExplorerData;
  query: string;
  selectedItemId: string;
  onQueryChange(query: string): void;
  onSelect(itemId: string): void;
}

export function ItemSearch({
  data,
  query,
  selectedItemId,
  onQueryChange,
  onSelect,
}: ItemSearchProps) {
  const results = searchItems(data.items, query).slice(0, 96);

  return (
    <aside className="sidebar app-panel">
      <div className="brand-mark">
        <Cog size={20} aria-hidden="true" />
        <span>Factorio Facts</span>
      </div>

      <div className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Search items and fluids"
          autoComplete="off"
          placeholder="Search items"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="item-list" aria-label="Items and fluids">
        {results.map((item) => {
          const kind = getItemKind(item, data.itemKindById);
          const icon = data.iconById.get(getIconIdForItem(item));

          return (
            <button
              className={`item-row ${item.id === selectedItemId ? "item-row--selected" : ""}`}
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              title={item.id}
            >
              <IconSprite atlas={data.atlas} icon={icon} label={item.name} size={30} />
              <span className="item-row__text">
                <span className="item-row__name">{item.name}</span>
                <span className="item-row__id">{item.id}</span>
              </span>
              {kind === "fluid" ? (
                <Droplets className="item-row__kind" size={16} aria-label="Fluid" />
              ) : (
                <Package className="item-row__kind" size={16} aria-label="Item" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
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
