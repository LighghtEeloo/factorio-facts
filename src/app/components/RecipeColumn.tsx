import type { RecipePrototype } from "../../factorio/prototypes";
import type { RecipeExplorerData } from "../data/factoriolab";
import { RecipeCard } from "./RecipeCard";

interface RecipeColumnProps {
  data: RecipeExplorerData;
  recipes: RecipePrototype[];
  selectedItemId: string;
  title: string;
  onSelectItem(itemId: string): void;
}

export function RecipeColumn({
  data,
  recipes,
  selectedItemId,
  title,
  onSelectItem,
}: RecipeColumnProps) {
  return (
    <section className="recipe-column">
      <div className="recipe-column__header">
        <h2>{title}</h2>
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
            />
          ))
        ) : (
          <div className="empty-state">No matching recipes</div>
        )}
      </div>
    </section>
  );
}
