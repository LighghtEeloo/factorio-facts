import { ArrowRight, Factory, ListPlus, MapPin, Timer } from "lucide-react";
import type { RecipePrototype } from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeIconId,
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
  focusedLayoutRecipeCount: number;
  onAddToLayout(recipeId: string): void;
  onSelectItem(itemId: string): void;
}

export function RecipeCard({
  data,
  recipe,
  selectedItemId,
  viewMode,
  focusedLayoutRecipeCount,
  onAddToLayout,
  onSelectItem,
}: RecipeCardProps) {
  const metadata = getRecipeMetadata(recipe);
  const icon = data.iconById.get(getRecipeIconId(recipe));
  const locations = metadata.locations.length ? metadata.locations.join(", ") : "all surfaces";
  const producerText = metadata.producers.length ? metadata.producers.join(", ") : "natural";
  const isConcise = viewMode === "concise";

  return (
    <article className={`recipe-card recipe-card--${viewMode}`} data-recipe-id={recipe.name}>
      <header className="recipe-card__header">
        <div className="recipe-card__identity">
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
        </div>

        <div className="recipe-card__side">
          <button
            aria-label="Add recipe to focused layout"
            className={`icon-button recipe-card__layout-button ${focusedLayoutRecipeCount > 0 ? "recipe-card__layout-button--duplicate" : ""}`}
            data-tooltip={
              focusedLayoutRecipeCount > 0
                ? `Add another copy (${focusedLayoutRecipeCount} in layout)`
                : "Add to focused layout"
            }
            type="button"
            onClick={() => onAddToLayout(recipe.name)}
          >
            <ListPlus size={16} aria-hidden="true" />
            {focusedLayoutRecipeCount > 0 ? (
              <span className="recipe-card__layout-count" aria-hidden="true">
                {focusedLayoutRecipeCount}
              </span>
            ) : null}
          </button>

          <div className="recipe-card__meta">
            <span
              className={isConcise ? "text-pill text-pill--time" : undefined}
              data-tooltip={isConcise ? `Craft time: ${formatTime(recipe.energy_required)}` : undefined}
              title={isConcise ? undefined : "Craft time"}
            >
              <Timer size={14} aria-hidden="true" />
              {formatTime(recipe.energy_required)}
            </span>
            {isConcise ? (
              <>
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
              </>
            ) : (
              <>
                <span title="Producer">
                  <Factory size={14} aria-hidden="true" />
                  {producerText}
                </span>
                <span title="Surface">
                  <MapPin size={14} aria-hidden="true" />
                  {locations}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="recipe-equation">
        <ItemGroup
          data={data}
          entries={recipe.ingredients ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          variant={viewMode}
        />
        <ArrowRight className="recipe-equation__arrow" size={18} aria-hidden="true" />
        <ItemGroup
          data={data}
          entries={recipe.results ?? []}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          variant={viewMode}
        />
      </div>

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
