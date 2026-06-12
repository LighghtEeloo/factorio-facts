import { ArrowRight, Factory, MapPin, Timer } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import type { ViewMode } from "../types";
import { IconSprite } from "./IconSprite";
import { ItemChip } from "./ItemChip";

interface RecipeCardProps {
  data: RecipeExplorerData;
  recipe: RecipePrototype;
  selectedItemId: string;
  viewMode: ViewMode;
  onSelectItem(itemId: string): void;
}

export function RecipeCard({
  data,
  recipe,
  selectedItemId,
  viewMode,
  onSelectItem,
}: RecipeCardProps) {
  const metadata = getRecipeMetadata(recipe);
  const recipeIconId = metadata.icon ?? recipe.results?.[0]?.name ?? recipe.name;
  const icon = data.iconById.get(recipeIconId);
  const locations = metadata.locations.length ? metadata.locations.join(", ") : "all surfaces";
  const producerText = metadata.producers.length ? metadata.producers.join(", ") : "natural";
  const isConcise = viewMode === "concise";

  return (
    <article className={`recipe-card recipe-card--${viewMode}`}>
      <header className="recipe-card__header">
        <IconSprite
          atlas={data.atlas}
          icon={icon}
          label={metadata.name}
          size={isConcise ? 30 : 38}
        />
        <div className="recipe-card__title">
          <h3>{metadata.name}</h3>
          {isConcise ? null : <span>{metadata.id}</span>}
        </div>
      </header>

      {isConcise ? null : (
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
      )}

      <div className="recipe-flow">
        <ItemGroup
          data={data}
          entries={recipe.ingredients ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          variant={viewMode}
        />
        <ArrowRight className="recipe-flow__arrow" size={18} aria-hidden="true" />
        <ItemGroup
          data={data}
          entries={recipe.results ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          variant={viewMode}
        />
      </div>

      {isConcise ? (
        <div className="recipe-compact-meta">
          <span
            className="text-pill text-pill--time"
            data-tooltip={`Craft time: ${formatTime(recipe.energy_required)}`}
          >
            <Timer size={13} aria-hidden="true" />
            {formatTime(recipe.energy_required)}
          </span>
          {metadata.producers.map((producerId) => (
            <IconPill data={data} id={producerId} key={producerId} type="producer" />
          ))}
          {metadata.locations.map((locationId) => (
            <IconPill data={data} id={locationId} key={locationId} type="surface" />
          ))}
          {metadata.producers.length ? null : (
            <span className="text-pill" data-tooltip="Natural source">
              natural
            </span>
          )}
        </div>
      ) : null}

      {!isConcise && (metadata.flags.length || metadata.disallowedEffects.length) ? (
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
  variant: ViewMode;
  onSelectItem(itemId: string): void;
}

function ItemGroup({
  data,
  entries,
  selectedItemId,
  variant,
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
              variant={variant}
            />
          );
        })
      ) : (
        <span className="empty-chip">none</span>
      )}
    </div>
  );
}

interface IconPillProps {
  data: RecipeExplorerData;
  id: string;
  type: "producer" | "surface";
}

function IconPill({ data, id, type }: IconPillProps) {
  const item = data.itemById.get(id);
  const location = data.locationById.get(id);
  const label = item?.name ?? location?.name ?? formatId(id);
  const iconId = item ? getIconIdForItem(item) : (location?.icon ?? id);
  const icon = data.iconById.get(iconId);
  const tooltipPrefix = type === "producer" ? "Producer" : "Surface";

  return (
    <span
      aria-label={`${tooltipPrefix}: ${label}`}
      className={`icon-pill icon-pill--${type}`}
      data-tooltip={`${tooltipPrefix}: ${label}`}
    >
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={22} />
    </span>
  );
}

function formatTime(value: number | undefined): string {
  if (value === undefined) {
    return "time n/a";
  }

  return `${Number(value.toFixed(2))}s`;
}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
