import type { FactorioLabItem } from "../../factoriolab/types";
import { getIconIdForItem, type RecipeExplorerData } from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface ItemChipProps {
  amount?: number | undefined;
  data: RecipeExplorerData;
  item: FactorioLabItem;
  isSelected?: boolean;
  onSelect?(itemId: string): void;
}

export function ItemChip({
  amount,
  data,
  item,
  isSelected = false,
  onSelect,
}: ItemChipProps) {
  const icon = data.iconById.get(getIconIdForItem(item));
  const amountText = amount === undefined ? undefined : formatAmount(amount);
  const isIconOnly = amountText === undefined;
  const title = amountText === undefined ? item.name : `${amountText}x ${item.name}`;
  const className = `item-chip ${isIconOnly ? "item-chip--icon-only" : ""} ${
    isSelected ? "item-chip--selected" : ""
  } ${onSelect ? "" : "item-chip--static"}`;
  const content = (
    <>
      <IconSprite
        atlas={data.atlas}
        icon={icon}
        label={item.name}
        size={22}
      />
      {amountText !== undefined ? (
        <span className="item-chip__times" aria-hidden="true">
          &times;
        </span>
      ) : null}
      {amountText !== undefined ? (
        <span className="item-chip__amount">
          {amountText}
        </span>
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <span
        aria-label={`${title} (${item.id})`}
        className={className}
        data-tooltip={`${title} (${item.id})`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      aria-label={`${title} (${item.id})`}
      className={className}
      data-tooltip={`${title} (${item.id})`}
      type="button"
      onClick={() => onSelect(item.id)}
    >
      {content}
    </button>
  );
}

function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return `${amount}`;
  }

  return `${Number(amount.toFixed(3))}`;
}
