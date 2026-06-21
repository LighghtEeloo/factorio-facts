import type { RecipePrototype } from "../../factorio/prototypes";
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
