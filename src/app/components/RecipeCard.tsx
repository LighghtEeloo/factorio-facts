import { ArrowRight, ListPlus } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import {
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { ItemChip } from "./ItemChip";
import { RecipeIcon } from "./RecipeIcon";
import { RecipeMetaPills } from "./RecipeMetaPills";

interface RecipeCardProps {
  data: RecipeExplorerData;
  recipe: RecipePrototype;
  selectedItemId: string;
  focusedLayoutRecipeCount?: number;
  onAddToLayout?(recipeId: string): void;
  onSelectItem(itemId: string): void;
}

export function RecipeCard({
  data,
  recipe,
  selectedItemId,
  focusedLayoutRecipeCount,
  onAddToLayout,
  onSelectItem,
}: RecipeCardProps) {
  const metadata = getRecipeMetadata(recipe);
  const showLayoutAction = Boolean(onAddToLayout);

  return (
    <article className="recipe-card" data-recipe-id={recipe.name}>
      <header className="recipe-card__header">
        <div className="recipe-card__identity">
          <RecipeIcon data={data} recipe={recipe} size={30} />
          <div className="recipe-card__title">
            <h3>{metadata.name}</h3>
          </div>
        </div>

        <div className="recipe-card__side">
          {showLayoutAction ? (
            <button
              aria-label="Add recipe to focused layout"
              className={`icon-button recipe-card__layout-button ${
                (focusedLayoutRecipeCount ?? 0) > 0
                  ? "recipe-card__layout-button--duplicate"
                  : ""
              }`}
              data-tooltip={
                (focusedLayoutRecipeCount ?? 0) > 0
                  ? `Add another copy (${focusedLayoutRecipeCount} in layout)`
                  : "Add to focused layout"
              }
              type="button"
              onClick={() => onAddToLayout?.(recipe.name)}
            >
              <ListPlus size={16} aria-hidden="true" />
              {(focusedLayoutRecipeCount ?? 0) > 0 ? (
                <span className="recipe-card__layout-count" aria-hidden="true">
                  {focusedLayoutRecipeCount}
                </span>
              ) : null}
            </button>
          ) : null}

          <RecipeMetaPills
            data={data}
            energyRequired={recipe.energy_required}
            metadata={metadata}
          />
        </div>
      </header>

      <div className="recipe-equation">
        <ItemGroup
          data={data}
          entries={recipe.ingredients ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
        <ArrowRight className="recipe-equation__arrow" size={18} aria-hidden="true" />
        <ItemGroup
          data={data}
          entries={recipe.results ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      </div>
    </article>
  );
}

interface ItemGroupProps {
  data: RecipeExplorerData;
  entries: readonly { name: string; amount?: number }[];
  selectedItemId: string;
  onSelectItem(itemId: string): void;
}

function ItemGroup({
  data,
  entries,
  selectedItemId,
  onSelectItem,
}: ItemGroupProps) {
  return (
    <div className="recipe-flow__items">
      {entries.length ? (
        entries.map((entry) => {
          const item = data.itemById.get(entry.name);

          if (!item) {
            return null;
          }

          return (
            <ItemChip
              amount={entry.amount}
              data={data}
              isSelected={entry.name === selectedItemId}
              item={item}
              key={entry.name}
              onSelect={onSelectItem}
            />
          );
        })
      ) : (
        <span className="empty-chip">none</span>
      )}
    </div>
  );
}
