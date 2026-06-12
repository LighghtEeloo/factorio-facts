import type { ReactNode } from "react";
import {
  Factory,
  Filter,
  FlaskConical,
  Lock,
  MapPin,
  Pickaxe,
  Recycle,
} from "lucide-react";
import type { RecipeExplorerData } from "../data/factoriolab";
import type { FilterState } from "../types";

interface FilterPanelProps {
  data: RecipeExplorerData;
  filters: FilterState;
  onChange(filters: FilterState): void;
}

export function FilterPanel({ data, filters, onChange }: FilterPanelProps) {
  return (
    <aside className="filters app-panel">
      <div className="panel-title">
        <Filter size={18} aria-hidden="true" />
        <h2>Filters</h2>
      </div>

      <label className="field">
        <span className="field__label">
          <MapPin size={16} aria-hidden="true" />
          Surface
        </span>
        <select
          value={filters.location}
          onChange={(event) => onChange({ ...filters, location: event.target.value })}
        >
          <option value="all">All surfaces</option>
          {data.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">
          <Factory size={16} aria-hidden="true" />
          Category
        </span>
        <select
          value={filters.category}
          onChange={(event) => onChange({ ...filters, category: event.target.value })}
        >
          <option value="all">All categories</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

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
