import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import type { RecipeExplorerData } from "../data/factoriolab";
import type { ViewMode } from "../types";
import { RecipeCard } from "./RecipeCard";

interface RecipeColumnProps {
  data: RecipeExplorerData;
  recipes: RecipePrototype[];
  selectedItemId: string;
  title: string;
  variant: "made-by" | "used-in";
  viewMode: ViewMode;
  onSelectItem(itemId: string): void;
}

export function RecipeColumn({
  data,
  recipes,
  selectedItemId,
  title,
  variant,
  viewMode,
  onSelectItem,
}: RecipeColumnProps) {
  const HeadingIcon = variant === "made-by" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <section className={`recipe-column recipe-column--${viewMode}`}>
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
              key={recipe.name}
              onSelectItem={onSelectItem}
              recipe={recipe}
              selectedItemId={selectedItemId}
              viewMode={viewMode}
            />
          ))
        ) : (
          <div className="empty-state">No matching recipes</div>
        )}
      </div>
    </section>
  );
}
