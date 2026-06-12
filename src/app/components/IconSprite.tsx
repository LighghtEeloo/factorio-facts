import type { FactorioLabIcon } from "../../factoriolab/types";
import type { RecipeExplorerData } from "../data/factoriolab";

interface IconSpriteProps {
  atlas: RecipeExplorerData["atlas"];
  icon?: FactorioLabIcon | undefined;
  label: string;
  size?: number;
}

export function IconSprite({ atlas, icon, label, size = 32 }: IconSpriteProps) {
  if (!icon) {
    return (
      <span
        className="icon-sprite icon-sprite--missing"
        aria-label={label}
        style={{ width: size, height: size }}
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  const scale = size / atlas.cellSize;

  return (
    <span
      className="icon-sprite"
      aria-label={label}
      role="img"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas.url})`,
        backgroundPosition: `${-icon.x * scale}px ${-icon.y * scale}px`,
        backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
      }}
    />
  );
}
