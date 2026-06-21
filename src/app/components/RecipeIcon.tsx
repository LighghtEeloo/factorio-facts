import type { RecipePrototype } from "../../factorio/prototypes";
import type { FactorioLabIcon } from "../../factoriolab/types";
import { isCompositeRecipe } from "../composite-recipes";
import {
  getRecipeIconId,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface RecipeIconProps {
  data: RecipeExplorerData;
  label?: string;
  recipe: RecipePrototype;
  size: number;
}

export function RecipeIcon({ data, label, recipe, size }: RecipeIconProps) {
  const metadata = getRecipeMetadata(recipe);

  if (isCompositeRecipe(recipe)) {
    const icons = getCompositeIconSprites(data, recipe);

    return (
      <CompositeRecipeIcon
        icons={icons}
        label={label ?? metadata.name}
        size={size}
        atlas={data.atlas}
      />
    );
  }

  const icon = data.iconById.get(getRecipeIconId(data, recipe));

  return (
    <IconSprite
      atlas={data.atlas}
      icon={icon}
      label={label ?? metadata.name}
      size={size}
    />
  );
}

interface CompositeRecipeIconProps {
  atlas: RecipeExplorerData["atlas"];
  icons: Array<{ icon?: FactorioLabIcon | undefined; label: string }>;
  label: string;
  size: number;
}

export function CompositeRecipeIcon({
  atlas,
  icons,
  label,
  size,
}: CompositeRecipeIconProps) {
  const visibleIcons = icons.slice(0, 4);

  if (!visibleIcons.length) {
    return <IconSprite atlas={atlas} label={label} size={size} />;
  }

  return (
    <span
      aria-label={label}
      className={`composite-recipe-icon composite-recipe-icon--${visibleIcons.length}`}
      role="img"
      style={{ width: size, height: size }}
    >
      {visibleIcons.map((entry, index) => (
        <span className="composite-recipe-icon__cell" key={`${entry.label}:${index}`}>
          <IconSprite
            atlas={atlas}
            icon={entry.icon}
            label={entry.label}
            size={getCompositeCellSize(size, visibleIcons.length)}
          />
        </span>
      ))}
    </span>
  );
}

function getCompositeIconSprites(
  data: RecipeExplorerData,
  recipe: RecipePrototype,
): Array<{ icon?: FactorioLabIcon | undefined; label: string }> {
  const icons = recipe.icons ?? [];

  return icons.map((iconData) => {
    const item = data.itemById.get(iconData.icon);
    const label = item?.name ?? iconData.icon.replaceAll("-", " ");

    return {
      icon: data.iconById.get(iconData.icon),
      label,
    };
  });
}

function getCompositeCellSize(size: number, count: number): number {
  return count === 1 ? Math.max(16, size - 6) : Math.max(14, Math.floor(size * 0.48));
}
