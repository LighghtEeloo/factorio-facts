import { ArrowRight, Factory, MapPin, Timer } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import { getRecipeMetadata, type RecipeExplorerData } from "../data/factoriolab";
import { IconSprite } from "./IconSprite";
import { ItemChip } from "./ItemChip";

interface RecipeCardProps {
  data: RecipeExplorerData;
  recipe: RecipePrototype;
  selectedItemId: string;
  onSelectItem(itemId: string): void;
}

export function RecipeCard({
  data,
  recipe,
  selectedItemId,
  onSelectItem,
}: RecipeCardProps) {
  const metadata = getRecipeMetadata(recipe);
  const recipeIconId = metadata.icon ?? recipe.results?.[0]?.name ?? recipe.name;
  const icon = data.iconById.get(recipeIconId);
  const locations = metadata.locations.length ? metadata.locations.join(", ") : "all surfaces";
  const producerText = metadata.producers.length ? metadata.producers.join(", ") : "natural";

  return (
    <article className="recipe-card">
      <header className="recipe-card__header">
        <IconSprite atlas={data.atlas} icon={icon} label={metadata.name} size={38} />
        <div className="recipe-card__title">
          <h3>{metadata.name}</h3>
          <span>{metadata.id}</span>
        </div>
      </header>

      <div className="recipe-card__meta">
        <span title="Craft time">
          <Timer size={14} aria-hidden="true" />
          {formatTime(recipe.energy_required)}
        </span>
        <span title="Producer">
          <Factory size={14} aria-hidden="true" />
          {producerText}
        </span>
        <span title="Surface">
          <MapPin size={14} aria-hidden="true" />
          {locations}
        </span>
      </div>

      <div className="recipe-flow">
        <ItemGroup
          data={data}
          entries={recipe.ingredients ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
        <ArrowRight className="recipe-flow__arrow" size={18} aria-hidden="true" />
        <ItemGroup
          data={data}
          entries={recipe.results ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      </div>

      {metadata.flags.length || metadata.disallowedEffects.length ? (
        <div className="recipe-tags">
          {metadata.flags.map((flag) => (
            <span key={flag}>{flag}</span>
          ))}
          {metadata.disallowedEffects.map((effect) => (
            <span key={effect}>no {effect}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

interface ItemGroupProps {
  data: RecipeExplorerData;
  entries: readonly { name: string; amount?: number }[];
  selectedItemId: string;
  onSelectItem(itemId: string): void;
}

function ItemGroup({ data, entries, selectedItemId, onSelectItem }: ItemGroupProps) {
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

function formatTime(value: number | undefined): string {
  if (value === undefined) {
    return "time n/a";
  }

  return `${Number(value.toFixed(2))}s`;
}
