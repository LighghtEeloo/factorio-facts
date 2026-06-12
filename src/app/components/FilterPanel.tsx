import type { ReactNode } from "react";
import {
  Filter,
  FlaskConical,
  Lock,
  Pickaxe,
  Recycle,
  RotateCcw,
} from "lucide-react";
import type { RecipeExplorerData } from "../data/factoriolab";
import type { FilterState } from "../types";
import { IconSprite } from "./IconSprite";

interface FilterPanelProps {
  data: RecipeExplorerData;
  filters: FilterState;
  onChange(filters: FilterState): void;
  onReset(): void;
}

export function FilterPanel({ data, filters, onChange, onReset }: FilterPanelProps) {
  return (
    <aside className="filters app-panel">
      <div className="panel-title">
        <span className="panel-title__label">
          <Filter size={18} aria-hidden="true" />
          <h2>Filters</h2>
        </span>
        <button
          aria-label="Reset filters"
          className="icon-button"
          data-tooltip="Reset filters"
          type="button"
          onClick={onReset}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="field">
        <span className="field__label">
          Surface
        </span>
        <div className="icon-filter-grid" role="group" aria-label="Surface filters">
          {data.locations.map((location) => (
            <IconFilterToggle
              checked={filters.locations.includes(location.id)}
              data={data}
              iconId={location.icon ?? location.id}
              id={location.id}
              key={location.id}
              label={location.name}
              onChange={(checked) =>
                onChange({
                  ...filters,
                  locations: toggleSelection(filters.locations, location.id, checked),
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">
          Category
        </span>
        <div className="icon-filter-grid" role="group" aria-label="Category filters">
          {data.categories.map((category) => (
            <IconFilterToggle
              checked={filters.categories.includes(category.id)}
              data={data}
              iconId={category.icon ?? category.id}
              id={category.id}
              key={category.id}
              label={category.name}
              onChange={(checked) =>
                onChange({
                  ...filters,
                  categories: toggleSelection(filters.categories, category.id, checked),
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="toggle-group">
        <Toggle
          checked={filters.includeLocked}
          icon={<Lock size={16} aria-hidden="true" />}
          label="Locked"
          onChange={(includeLocked) => onChange({ ...filters, includeLocked })}
        />
        <Toggle
          checked={filters.includeMining}
          icon={<Pickaxe size={16} aria-hidden="true" />}
          label="Mining"
          onChange={(includeMining) => onChange({ ...filters, includeMining })}
        />
        <Toggle
          checked={filters.includeRecycling}
          icon={<Recycle size={16} aria-hidden="true" />}
          label="Recycling"
          onChange={(includeRecycling) => onChange({ ...filters, includeRecycling })}
        />
        <Toggle
          checked={filters.includeTechnology}
          icon={<FlaskConical size={16} aria-hidden="true" />}
          label="Technology"
          onChange={(includeTechnology) => onChange({ ...filters, includeTechnology })}
        />
      </div>
    </aside>
  );
}

interface IconFilterToggleProps {
  checked: boolean;
  data: RecipeExplorerData;
  iconId: string;
  id: string;
  label: string;
  onChange(checked: boolean): void;
}

function IconFilterToggle({
  checked,
  data,
  iconId,
  id,
  label,
  onChange,
}: IconFilterToggleProps) {
  const icon = data.iconById.get(iconId);

  return (
    <label
      className={`filter-icon-toggle ${checked ? "filter-icon-toggle--checked" : ""}`}
      data-filter-id={id}
      data-tooltip={label}
    >
      <input
        aria-label={label}
        checked={checked}
        type="checkbox"
        value={id}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="filter-icon-toggle__frame">
        <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
      </span>
    </label>
  );
}

function toggleSelection(values: string[], id: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(id) ? values : [...values, id];
  }

  return values.filter((value) => value !== id);
}

interface ToggleProps {
  checked: boolean;
  icon: ReactNode;
  label: string;
  onChange(checked: boolean): void;
}

function Toggle({ checked, icon, label, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <input
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__box">{icon}</span>
      <span>{label}</span>
    </label>
  );
}
