import type {
  FactorioLabIcon,
  FactorioLabItem,
  FactorioLabModule,
  FactorioLabModuleEffect,
} from "../factoriolab/types";
import type { RecipePrototype } from "../factorio/prototypes";
import { getIconIdForItem, getRecipeMetadata, type RecipeExplorerData } from "./data/factoriolab";
import type {
  LayoutBeaconSettings,
  LayoutModuleSettings,
  RecipeLayoutEntry,
} from "./types";

const goodNegativeEffects = new Set<FactorioLabModuleEffect>([
  "consumption",
  "pollution",
]);
const preferredMachineModules = [
  "productivity-module-3",
  "speed-module-3",
  "quality-module-3",
  "efficiency-module-3",
  "productivity-module",
  "speed-module",
  "quality-module",
  "efficiency-module",
];
const preferredBeaconModules = [
  "speed-module-3",
  "speed-module",
  "efficiency-module-3",
  "efficiency-module",
];

export interface LayoutFactoryItemOption {
  icon: FactorioLabIcon | undefined;
  id: string;
  name: string;
}

export function getRecipeSelectedMachineId(
  recipe: RecipePrototype,
  machineId: string | undefined,
): string | null {
  const producers = getRecipeMetadata(recipe).producers;

  return producers.includes(machineId ?? "") ? (machineId ?? null) : (producers[0] ?? null);
}

export function getRecipeModuleOptions(
  data: RecipeExplorerData,
  recipe: RecipePrototype,
  machineId: string | null,
): LayoutFactoryItemOption[] {
  const machine = machineId ? data.itemById.get(machineId)?.machine : undefined;

  if (!machine?.modules) {
    return [];
  }

  return getModuleOptions(data, [
    ...getRecipeMetadata(recipe).disallowedEffects,
    ...(machine.disallowedEffects ?? []),
  ]);
}

export function getBeaconOptions(data: RecipeExplorerData): LayoutFactoryItemOption[] {
  return data.items
    .filter((item) => Boolean(item.beacon))
    .map((item) => createFactoryItemOption(data, item));
}

export function getBeaconModuleOptions(
  data: RecipeExplorerData,
  beaconId: string | null,
): LayoutFactoryItemOption[] {
  const beacon = beaconId ? data.itemById.get(beaconId)?.beacon : undefined;

  if (!beacon?.modules) {
    return [];
  }

  return getModuleOptions(data, beacon.disallowedEffects ?? []);
}

export function getMachineModuleCapacity(
  data: RecipeExplorerData,
  machineId: string | null,
): number | true | null {
  const modules = machineId ? data.itemById.get(machineId)?.machine?.modules : undefined;

  if (modules === true) {
    return true;
  }

  return typeof modules === "number" && modules > 0 ? modules : null;
}

export function getBeaconModuleCapacity(
  data: RecipeExplorerData,
  beaconId: string | null,
): number | true | null {
  const modules = beaconId ? data.itemById.get(beaconId)?.beacon?.modules : undefined;
  const count = toNumber(modules);

  return count && count > 0 ? count : null;
}

export function getDefaultMachineModuleSettings(
  options: readonly LayoutFactoryItemOption[],
  capacity: number | true | null,
): LayoutModuleSettings[] {
  const id = getPreferredOptionId(options, preferredMachineModules);
  const count = capacity === true || capacity === null ? 1 : Math.min(1, capacity);

  return id && count > 0 ? [{ id, count }] : [];
}

export function getDefaultBeaconSettings(data: RecipeExplorerData): LayoutBeaconSettings[] {
  const beacon = getBeaconOptions(data)[0];

  if (!beacon) {
    return [];
  }

  const moduleOptions = getBeaconModuleOptions(data, beacon.id);
  const moduleId = getPreferredOptionId(moduleOptions, preferredBeaconModules);
  const moduleCapacity = getBeaconModuleCapacity(data, beacon.id);
  const moduleCount = moduleCapacity === true || moduleCapacity === null ? 1 : moduleCapacity;

  return [
    {
      id: beacon.id,
      count: 1,
      modules: moduleId ? [{ id: moduleId, count: moduleCount }] : [],
    },
  ];
}

export function getDefaultBeaconModuleSettings(
  data: RecipeExplorerData,
  beaconId: string,
): LayoutModuleSettings[] {
  const moduleOptions = getBeaconModuleOptions(data, beaconId);
  const moduleId = getPreferredOptionId(moduleOptions, preferredBeaconModules);
  const moduleCapacity = getBeaconModuleCapacity(data, beaconId);
  const moduleCount = moduleCapacity === true || moduleCapacity === null ? 1 : moduleCapacity;

  return moduleId ? [{ id: moduleId, count: moduleCount }] : [];
}

export function sanitizeRecipeLayoutEntryFactorySettings(
  data: RecipeExplorerData,
  entry: RecipeLayoutEntry,
): RecipeLayoutEntry {
  const recipe = data.recipeById.get(entry.recipeId);

  if (!recipe) {
    return stripFactorySettings(entry);
  }

  const machineId = getRecipeSelectedMachineId(recipe, entry.machineId);
  const moduleOptions = getRecipeModuleOptions(data, recipe, machineId);
  const moduleCapacity = getMachineModuleCapacity(data, machineId);

  if (!moduleOptions.length || !moduleCapacity) {
    return stripFactorySettings(entry);
  }

  const modules = sanitizeModuleSettings(
    entry.modules,
    moduleOptions,
    moduleCapacity,
  );
  const beacons = sanitizeBeaconSettings(data, entry.beacons);
  const baseEntry = stripFactorySettings(entry);

  return {
    ...baseEntry,
    ...(modules.length ? { modules } : {}),
    ...(beacons.length ? { beacons } : {}),
  };
}

export function sanitizeModuleSettings(
  value: readonly LayoutModuleSettings[] | undefined,
  options: readonly LayoutFactoryItemOption[],
  capacity: number | true | null,
): LayoutModuleSettings[] {
  if (!value?.length || !capacity) {
    return [];
  }

  const optionIds = new Set(options.map((option) => option.id));
  const byId = new Map<string, number>();
  const order: string[] = [];
  let remaining = capacity === true ? Number.POSITIVE_INFINITY : capacity;

  for (const setting of value) {
    if (!optionIds.has(setting.id)) {
      continue;
    }

    const count = normalizeFactoryCount(setting.count);

    if (count === null) {
      continue;
    }

    if (count === 0) {
      if (!byId.has(setting.id)) {
        order.push(setting.id);
        byId.set(setting.id, 0);
      }
      continue;
    }

    if (remaining <= 0) {
      continue;
    }

    const boundedCount = Math.min(count, remaining);

    if (!byId.has(setting.id)) {
      order.push(setting.id);
    }

    byId.set(setting.id, normalizeFactoryCount((byId.get(setting.id) ?? 0) + boundedCount) ?? 0);
    remaining -= boundedCount;
  }

  return order.flatMap((id) => {
    const count = byId.get(id);

    return count !== undefined ? [{ id, count }] : [];
  });
}

export function sanitizeBeaconSettings(
  data: RecipeExplorerData,
  value: readonly LayoutBeaconSettings[] | undefined,
): LayoutBeaconSettings[] {
  if (!value?.length) {
    return [];
  }

  const beaconIds = new Set(getBeaconOptions(data).map((option) => option.id));

  return value.flatMap((setting) => {
    if (!beaconIds.has(setting.id)) {
      return [];
    }

    const count = normalizeFactoryCount(setting.count);

    if (count === null) {
      return [];
    }

    const moduleOptions = getBeaconModuleOptions(data, setting.id);
    const moduleCapacity = getBeaconModuleCapacity(data, setting.id);
    const modules = sanitizeModuleSettings(
      setting.modules,
      moduleOptions,
      moduleCapacity,
    );

    return [{ id: setting.id, count, modules }];
  });
}

export function normalizeFactoryCount(value: number): number | null {
  return Number.isFinite(value) && value >= 0
    ? Math.round(value * 1_000_000) / 1_000_000
    : null;
}

export function getFactorySettingsSummaryCount(
  modules: readonly LayoutModuleSettings[] | undefined,
  beacons: readonly LayoutBeaconSettings[] | undefined,
): number {
  return (modules?.length ?? 0) + (beacons?.length ?? 0);
}

function getModuleOptions(
  data: RecipeExplorerData,
  disallowedEffects: readonly FactorioLabModuleEffect[],
): LayoutFactoryItemOption[] {
  return data.items
    .filter((item): item is FactorioLabItem & { module: FactorioLabModule } =>
      Boolean(item.module),
    )
    .filter((item) =>
      disallowedEffects.every((effect) => isModuleAllowedForEffect(item.module, effect)),
    )
    .map((item) => createFactoryItemOption(data, item));
}

function isModuleAllowedForEffect(
  module: FactorioLabModule,
  effect: FactorioLabModuleEffect,
): boolean {
  const value = toNumber(module[effect]);

  if (value === null || value === 0) {
    return true;
  }

  return goodNegativeEffects.has(effect) ? value >= 0 : value <= 0;
}

function createFactoryItemOption(
  data: RecipeExplorerData,
  item: FactorioLabItem,
): LayoutFactoryItemOption {
  return {
    icon: data.iconById.get(getIconIdForItem(item)),
    id: item.id,
    name: item.name,
  };
}

function getPreferredOptionId(
  options: readonly LayoutFactoryItemOption[],
  preferredIds: readonly string[],
): string | null {
  const optionIds = new Set(options.map((option) => option.id));

  return preferredIds.find((id) => optionIds.has(id)) ?? options[0]?.id ?? null;
}

function stripFactorySettings(entry: RecipeLayoutEntry): RecipeLayoutEntry {
  const { beacons: _beacons, modules: _modules, ...rest } = entry;

  return rest;
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}
