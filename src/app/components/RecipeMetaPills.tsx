import type { ReactNode } from "react";
import { Timer } from "lucide-react";
import type { FactorioLabRecipeMetadata } from "../../factoriolab/types";
import {
  getIconIdForItem,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { IconSprite } from "./IconSprite";

interface RecipeMetaPillsClassNames {
  icon?: string;
  producer?: string;
  root?: string;
  surface?: string;
  text?: string;
  time?: string;
}

interface RecipeMetaPillsProps {
  classNames?: RecipeMetaPillsClassNames;
  data: RecipeExplorerData;
  energyRequired: number | undefined;
  iconSize?: number;
  includeAllSurfaces?: boolean;
  leading?: ReactNode;
  metadata: FactorioLabRecipeMetadata;
  producerIds?: string[];
}

export function RecipeMetaPills({
  classNames,
  data,
  energyRequired,
  iconSize = 22,
  includeAllSurfaces = false,
  leading,
  metadata,
  producerIds: producerIdsOverride,
}: RecipeMetaPillsProps) {
  const rootClassName = classNames?.root ?? "recipe-card__meta";
  const textClassName = classNames?.text ?? "text-pill";
  const timeClassName = classNames?.time ?? `${textClassName} text-pill--time`;
  const producerIds = producerIdsOverride ?? metadata.producers;

  return (
    <div className={rootClassName}>
      {leading}
      <span
        className={timeClassName}
        data-tooltip={`Craft time: ${formatRecipeTime(energyRequired)}`}
      >
        <Timer size={14} aria-hidden="true" />
        {formatRecipeTime(energyRequired)}
      </span>
      {producerIds.map((producerId) => (
        <RecipeMetaIconPill
          classNames={classNames}
          data={data}
          iconSize={iconSize}
          id={producerId}
          key={producerId}
          type="producer"
        />
      ))}
      {producerIds.length ? null : (
        <span className={textClassName} data-tooltip="Natural source">
          natural
        </span>
      )}
      {metadata.locations.map((locationId) => (
        <RecipeMetaIconPill
          classNames={classNames}
          data={data}
          iconSize={iconSize}
          id={locationId}
          key={locationId}
          type="surface"
        />
      ))}
      {includeAllSurfaces && !metadata.locations.length ? (
        <span className={textClassName} data-tooltip="Available on all surfaces">
          all surfaces
        </span>
      ) : null}
    </div>
  );
}

interface RecipeMetaIconPillProps {
  classNames: RecipeMetaPillsClassNames | undefined;
  data: RecipeExplorerData;
  iconSize: number;
  id: string;
  type: "producer" | "surface";
}

function RecipeMetaIconPill({
  classNames,
  data,
  iconSize,
  id,
  type,
}: RecipeMetaIconPillProps) {
  const item = data.itemById.get(id);
  const location = data.locationById.get(id);
  const label = item?.name ?? location?.name ?? formatId(id);
  const iconId = item ? getIconIdForItem(item) : (location?.icon ?? id);
  const icon = data.iconById.get(iconId);
  const tooltipPrefix = type === "producer" ? "Producer" : "Surface";
  const iconClassName = classNames?.icon ?? "icon-pill";
  const typeClassName =
    type === "producer"
      ? classNames?.producer ?? "icon-pill--producer"
      : classNames?.surface ?? "icon-pill--surface";

  return (
    <span
      aria-label={`${tooltipPrefix}: ${label}`}
      className={`${iconClassName} ${typeClassName}`}
      data-tooltip={`${tooltipPrefix}: ${label}`}
    >
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={iconSize} />
    </span>
  );
}

export function formatRecipeTime(value: number | undefined): string {
  if (value === undefined) {
    return "time n/a";
  }

  return `${Number(value.toFixed(2))}s`;
}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
