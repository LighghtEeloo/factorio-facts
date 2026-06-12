import type { FactorioLabItem } from "../../factoriolab/types";
import { getIconIdForItem, type RecipeExplorerData } from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface ItemChipProps {
  amount?: number | undefined;
  data: RecipeExplorerData;
  item: FactorioLabItem;
  isSelected?: boolean;
  onSelect(itemId: string): void;
}

export function ItemChip({
  amount,
  data,
  item,
  isSelected = false,
  onSelect,
}: ItemChipProps) {
  const icon = data.iconById.get(getIconIdForItem(item));

  return (
    <button
      className={`item-chip ${isSelected ? "item-chip--selected" : ""}`}
      type="button"
      onClick={() => onSelect(item.id)}
      title={item.id}
    >
      <IconSprite atlas={data.atlas} icon={icon} label={item.name} size={24} />
      {amount !== undefined ? (
        <span className="item-chip__amount">{formatAmount(amount)}</span>
      ) : null}
      <span className="item-chip__name">{item.name}</span>
    </button>
  );
}

function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return `${amount}x`;
  }

  return `${Number(amount.toFixed(3))}x`;
}
