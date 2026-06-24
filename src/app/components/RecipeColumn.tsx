import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import type { RecipeExplorerData } from "../data/factoriolab";
import { RecipeCard } from "./RecipeCard";

interface RecipeColumnProps {
  data: RecipeExplorerData;
  recipes: RecipePrototype[];
  selectedItemId: string;
  title: string;
  variant: "made-by" | "used-in";
  getFocusedLayoutRecipeCount?(recipeId: string): number;
  onAddRecipeToLayout?(recipeId: string): void;
  onSelectItem(itemId: string): void;
}

export function RecipeColumn({
  data,
  recipes,
  selectedItemId,
  title,
  variant,
  getFocusedLayoutRecipeCount,
  onAddRecipeToLayout,
  onSelectItem,
}: RecipeColumnProps) {
  const HeadingIcon = variant === "made-by" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <section className="recipe-column">
      <div className="recipe-column__header">
        <h2>
          <HeadingIcon size={15} aria-hidden="true" />
          {title}
        </h2>
        <span>{recipes.length}</span>
      </div>

      <div className="recipe-column__list">
        {recipes.length ? (
          recipes.map((recipe) => (
            <RecipeCard
              data={data}
              focusedLayoutRecipeCount={
                getFocusedLayoutRecipeCount?.(recipe.name) ?? 0
              }
              key={recipe.name}
              onSelectItem={onSelectItem}
              recipe={recipe}
              selectedItemId={selectedItemId}
              {...(onAddRecipeToLayout
                ? { onAddToLayout: onAddRecipeToLayout }
                : {})}
            />
          ))
        ) : (
          <div className="empty-state">No matching recipes</div>
        )}
      </div>
    </section>
  );
}
