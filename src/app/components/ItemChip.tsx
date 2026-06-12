import type { FactorioLabItem } from "../../factoriolab/types";
import { getIconIdForItem, type RecipeExplorerData } from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface ItemChipProps {
  amount?: number | undefined;
  data: RecipeExplorerData;
  item: FactorioLabItem;
  isSelected?: boolean;
  variant?: "detailed" | "concise";
  onSelect(itemId: string): void;
}

export function ItemChip({
  amount,
  data,
  item,
  isSelected = false,
  variant = "detailed",
  onSelect,
}: ItemChipProps) {
  const icon = data.iconById.get(getIconIdForItem(item));
  const isConcise = variant === "concise";
  const title = amount === undefined ? item.name : `${formatAmount(amount)} ${item.name}`;

  return (
    <button
      aria-label={`${title} (${item.id})`}
      className={`item-chip item-chip--${variant} ${isSelected ? "item-chip--selected" : ""}`}
      data-tooltip={isConcise ? `${title} (${item.id})` : undefined}
      type="button"
      onClick={() => onSelect(item.id)}
      title={isConcise ? undefined : `${title} (${item.id})`}
    >
      <IconSprite
        atlas={data.atlas}
        icon={icon}
        label={item.name}
        size={isConcise ? 22 : 24}
      />
      {amount !== undefined ? (
        <span className="item-chip__amount">{formatAmount(amount)}</span>
      ) : null}
      {isConcise ? null : <span className="item-chip__name">{item.name}</span>}
    </button>
  );
}

function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return `${amount}x`;
  }

  return `${Number(amount.toFixed(3))}x`;
}
