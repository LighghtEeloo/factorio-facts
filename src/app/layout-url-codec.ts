import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { defaultProductionSize } from "./types";
import type {
  GraphEdgePorts,
  GraphEdgeRoute,
  GraphNodePosition,
  GraphRelay,
  GraphSide,
  GraphTerminalKind,
  InstalledLayoutRecipe,
  LayoutBeaconSettings,
  LayoutModuleSettings,
  RecipeLayout,
  RecipeLayoutEntry,
} from "./types";

const layoutStateBlobPrefix = "v1.";
const compositeRecipeIdPrefix = "composite:";
const graphSides = ["top", "right", "bottom", "left"] as const satisfies readonly GraphSide[];
const defaultSourceSide: GraphSide = "right";
const defaultTargetSide: GraphSide = "left";
const defaultInputSide: GraphSide = "left";
const defaultOutputSide: GraphSide = "right";

type GraphSideCode = 0 | 1 | 2 | 3;
type GraphTerminalKindCode = 0 | 1;
type CompactEntry =
  | number
  | [recipeIndex: number, productionSize: number]
  | [recipeIndex: number, productionSize: number, machineId: string]
  | [
      recipeIndex: number,
      productionSize: number,
      machineId: string | null,
      factorySettings: CompactFactorySettings,
    ];
type CompactModuleSettings = [moduleId: string, count: number];
type CompactBeaconSettings = [
  beaconId: string,
  count: number,
  modules: CompactModuleSettings[],
];
interface CompactFactorySettings {
  b?: CompactBeaconSettings[];
  u?: CompactModuleSettings[];
}
type CompactPosition = [entryIndex: number, x: number, y: number];
type CompactEdgePorts = [
  sourceIndex: number,
  targetIndex: number,
  sourceSide: GraphSideCode,
  targetSide: GraphSideCode,
];
type CompactEdgeRoute = [
  sourceIndex: number,
  targetIndex: number,
  x: number,
  y: number,
];
type CompactTerminalSide = [
  entryIndex: number,
  kind: GraphTerminalKindCode,
  side: GraphSideCode,
];
type CompactEdgeItems = [
  sourceIndex: number,
  targetIndex: number,
  itemIndexes: number[],
];
type CompactExternalItems = [
  entryIndex: number,
  kind: GraphTerminalKindCode,
  itemIndexes: number[],
];
type CompactRelay = [itemIndexes: number[]];
type CompactLayoutIconIds = number[];
type CompactInstalledRecipe = [recipeId: string, layout: unknown[]];

export interface ParsedLayoutUrlState {
  focusedLayoutId: string;
  installedRecipes: InstalledLayoutRecipe[];
  layouts: RecipeLayout[];
}

export interface LayoutUrlCodecOptions {
  defaultLayoutId: string;
  isRecipeIdAllowed(recipeId: string): boolean;
  isRecipeMachineIdAllowed(recipeId: string, machineId: string): boolean;
}

export function serializeCompactLayoutState(
  layouts: RecipeLayout[],
  focusedLayoutId: string,
  installedRecipes: InstalledLayoutRecipe[] = [],
): string {
  const recipeIndexById = new Map<string, number>();
  const recipeIds: string[] = [];
  const itemIndexByKey = new Map<string, number>();
  const itemKeys: string[] = [];

  for (const layout of [
    ...layouts,
    ...installedRecipes.map((installedRecipe) => installedRecipe.layout),
  ]) {
    for (const entry of layout.entries) {
      getRecipeIndex(entry.recipeId, recipeIds, recipeIndexById);
    }

    for (const itemKey of layout.relays.flatMap((relay) => relay.itemKeys)) {
      getStringIndex(itemKey, itemKeys, itemIndexByKey);
    }

    for (const itemKey of Object.values(layout.edgeItems).flat()) {
      getStringIndex(itemKey, itemKeys, itemIndexByKey);
    }

    for (const itemKey of Object.values(layout.externalItems).flat()) {
      getStringIndex(itemKey, itemKeys, itemIndexByKey);
    }

    for (const iconId of layout.iconIds) {
      getStringIndex(iconId, itemKeys, itemIndexByKey);
    }
  }

  const focusedLayoutIndex = layouts.findIndex((layout) => layout.id === focusedLayoutId);
  const compactState: Record<string, unknown> = {
    r: recipeIds,
    l: layouts.map((layout) =>
      compactLayout(layout, recipeIds, recipeIndexById, itemKeys, itemIndexByKey),
    ),
  };

  if (itemKeys.length) {
    compactState.g = itemKeys;
  }

  if (installedRecipes.length) {
    compactState.i = installedRecipes.map((installedRecipe) => [
      installedRecipe.id,
      compactLayout(
        installedRecipe.layout,
        recipeIds,
        recipeIndexById,
        itemKeys,
        itemIndexByKey,
      ),
    ] satisfies CompactInstalledRecipe);
  }

  if (focusedLayoutIndex > 0) {
    compactState.f = focusedLayoutIndex;
  }

  return `${layoutStateBlobPrefix}${makeUriUnreserved(
    compressToEncodedURIComponent(JSON.stringify(compactState)),
  )}`;
}

export function parseCompactLayoutState(
  value: string | null,
  options: LayoutUrlCodecOptions,
): ParsedLayoutUrlState | null {
  if (!value?.startsWith(layoutStateBlobPrefix)) {
    return null;
  }

  try {
    const compressed = restoreUriSafeAlphabet(value.slice(layoutStateBlobPrefix.length));
    const json = decompressFromEncodedURIComponent(compressed);

    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return parseCompactState(parsed, options);
  } catch {
    return null;
  }
}

function compactLayout(
  layout: RecipeLayout,
  recipeIds: string[],
  recipeIndexById: Map<string, number>,
  itemKeys: string[],
  itemIndexByKey: Map<string, number>,
): unknown[] {
  const nodeIndexById = getLayoutGraphNodeIndexById(layout);
  const compact: unknown[] = [
    layout.name,
    layout.collapsed ? 1 : 0,
    layout.entries.map((entry) =>
      compactLayoutEntry(entry, recipeIds, recipeIndexById),
    ),
  ];

  setCompactSlot(compact, 3, compactGraphPositions(layout.graphPositions, nodeIndexById));
  setCompactSlot(compact, 4, compactGraphEdgePorts(layout.edgePorts, nodeIndexById));
  setCompactSlot(compact, 5, compactGraphEdgeRoutes(layout.edgeRoutes, nodeIndexById));
  setCompactSlot(compact, 6, compactGraphTerminalSides(layout.terminalSides, nodeIndexById));
  setCompactSlot(
    compact,
    7,
    compactGraphEdgeItems(layout.edgeItems, nodeIndexById, itemKeys, itemIndexByKey),
  );
  setCompactSlot(
    compact,
    8,
    compactGraphExternalItems(
      layout.externalItems,
      nodeIndexById,
      itemKeys,
      itemIndexByKey,
    ),
  );
  setCompactSlot(
    compact,
    9,
    compactGraphRelays(layout.relays, itemKeys, itemIndexByKey),
  );
  setCompactSlot(
    compact,
    10,
    compactLayoutIconIds(layout.iconIds, itemKeys, itemIndexByKey),
  );

  return compact;
}

function compactLayoutEntry(
  entry: RecipeLayoutEntry,
  recipeIds: string[],
  recipeIndexById: Map<string, number>,
): CompactEntry {
  const recipeIndex = getRecipeIndex(entry.recipeId, recipeIds, recipeIndexById);
  const productionSize = normalizeProductionSize(entry.productionSize);
  const factorySettings = compactFactorySettings(entry);

  if (
    !factorySettings &&
    !entry.machineId &&
    productionSize === defaultProductionSize
  ) {
    return recipeIndex;
  }

  if (factorySettings) {
    return [recipeIndex, productionSize, entry.machineId ?? null, factorySettings];
  }

  return entry.machineId ? [recipeIndex, productionSize, entry.machineId] : [recipeIndex, productionSize];
}

function compactFactorySettings(entry: RecipeLayoutEntry): CompactFactorySettings | null {
  const modules = compactModuleSettings(entry.modules);
  const beacons = compactBeaconSettings(entry.beacons);

  return modules || beacons
    ? {
        ...(beacons ? { b: beacons } : {}),
        ...(modules ? { u: modules } : {}),
      }
    : null;
}

function compactModuleSettings(
  modules: readonly LayoutModuleSettings[] | undefined,
): CompactModuleSettings[] | null {
  const settings = modules
    ?.flatMap((module) => {
      const count = normalizeFactorySettingCount(module.count);

      return count === null
        ? []
        : ([[module.id, count]] satisfies CompactModuleSettings[]);
    });

  return settings?.length ? settings : null;
}

function compactBeaconSettings(
  beacons: readonly LayoutBeaconSettings[] | undefined,
): CompactBeaconSettings[] | null {
  const settings = beacons
    ?.flatMap((beacon) => {
      const count = normalizeFactorySettingCount(beacon.count);

      return count === null
        ? []
        : ([
            [
              beacon.id,
              count,
              compactModuleSettings(beacon.modules) ?? [],
            ],
          ] satisfies CompactBeaconSettings[]);
    });

  return settings?.length ? settings : null;
}

function getLayoutGraphNodeIndexById(layout: RecipeLayout): Map<string, number> {
  return new Map([
    ...layout.entries.map((entry, index) => [entry.id, index] as const),
    ...layout.relays.map(
      (relay, index) => [relay.id, layout.entries.length + index] as const,
    ),
  ]);
}

function compactGraphPositions(
  graphPositions: Record<string, GraphNodePosition>,
  entryIndexById: Map<string, number>,
): CompactPosition[] {
  return Object.entries(graphPositions)
    .flatMap(([entryId, position]) => {
      const entryIndex = entryIndexById.get(entryId);

      return entryIndex === undefined
        ? []
        : ([[entryIndex, Math.round(position.x), Math.round(position.y)]] satisfies CompactPosition[]);
    })
    .sort(compareFirstNumber);
}

function compactGraphEdgePorts(
  edgePorts: Record<string, GraphEdgePorts>,
  entryIndexById: Map<string, number>,
): CompactEdgePorts[] {
  return Object.entries(edgePorts)
    .flatMap(([edgeId, ports]) => {
      const edge = parseGraphEdgeId(edgeId);

      if (!edge) {
        return [];
      }

      if (
        ports.sourceSide === defaultSourceSide &&
        ports.targetSide === defaultTargetSide
      ) {
        return [];
      }

      const sourceIndex = entryIndexById.get(edge.sourceId);
      const targetIndex = entryIndexById.get(edge.targetId);
      const sourceSide = encodeGraphSide(ports.sourceSide);
      const targetSide = encodeGraphSide(ports.targetSide);

      return sourceIndex === undefined ||
        targetIndex === undefined ||
        sourceSide === null ||
        targetSide === null
        ? []
        : ([[sourceIndex, targetIndex, sourceSide, targetSide]] satisfies CompactEdgePorts[]);
    })
    .sort(compareFirstTwoNumbers);
}

function compactGraphEdgeRoutes(
  edgeRoutes: Record<string, GraphEdgeRoute>,
  entryIndexById: Map<string, number>,
): CompactEdgeRoute[] {
  return Object.entries(edgeRoutes)
    .flatMap(([edgeId, route]) => {
      const edge = parseGraphEdgeId(edgeId);

      if (!edge) {
        return [];
      }

      const sourceIndex = entryIndexById.get(edge.sourceId);
      const targetIndex = entryIndexById.get(edge.targetId);

      return sourceIndex === undefined || targetIndex === undefined
        ? []
        : ([
            [sourceIndex, targetIndex, Math.round(route.x), Math.round(route.y)],
          ] satisfies CompactEdgeRoute[]);
    })
    .sort(compareFirstTwoNumbers);
}

function compactGraphTerminalSides(
  terminalSides: Record<string, GraphSide>,
  entryIndexById: Map<string, number>,
): CompactTerminalSide[] {
  return Object.entries(terminalSides)
    .flatMap(([terminalId, side]) => {
      const terminal = parseGraphTerminalId(terminalId);

      if (!terminal) {
        return [];
      }

      if (
        (terminal.kind === "input" && side === defaultInputSide) ||
        (terminal.kind === "output" && side === defaultOutputSide)
      ) {
        return [];
      }

      const entryIndex = entryIndexById.get(terminal.entryId);
      const sideCode = encodeGraphSide(side);

      return entryIndex === undefined || sideCode === null
        ? []
        : ([[entryIndex, encodeGraphTerminalKind(terminal.kind), sideCode]] satisfies CompactTerminalSide[]);
    })
    .sort(compareFirstTwoNumbers);
}

function compactGraphEdgeItems(
  edgeItems: Record<string, string[]>,
  entryIndexById: Map<string, number>,
  itemKeys: string[],
  itemIndexByKey: Map<string, number>,
): CompactEdgeItems[] {
  return Object.entries(edgeItems)
    .flatMap(([edgeId, itemKeyList]) => {
      const edge = parseGraphEdgeId(edgeId);

      if (!edge) {
        return [];
      }

      const sourceIndex = entryIndexById.get(edge.sourceId);
      const targetIndex = entryIndexById.get(edge.targetId);

      return sourceIndex === undefined || targetIndex === undefined
        ? []
        : ([
            [
              sourceIndex,
              targetIndex,
              compactStringIndexes(itemKeyList, itemKeys, itemIndexByKey),
            ],
          ] satisfies CompactEdgeItems[]);
    })
    .sort(compareFirstTwoNumbers);
}

function compactGraphExternalItems(
  externalItems: Record<string, string[]>,
  entryIndexById: Map<string, number>,
  itemKeys: string[],
  itemIndexByKey: Map<string, number>,
): CompactExternalItems[] {
  return Object.entries(externalItems)
    .flatMap(([terminalId, itemKeyList]) => {
      const terminal = parseGraphTerminalId(terminalId);

      if (!terminal) {
        return [];
      }

      const entryIndex = entryIndexById.get(terminal.entryId);
      const itemIndexes = compactStringIndexes(itemKeyList, itemKeys, itemIndexByKey);

      return entryIndex === undefined || !itemIndexes.length
        ? []
        : ([
            [
              entryIndex,
              encodeGraphTerminalKind(terminal.kind),
              itemIndexes,
            ],
          ] satisfies CompactExternalItems[]);
    })
    .sort(compareFirstTwoNumbers);
}

function compactGraphRelays(
  relays: GraphRelay[],
  itemKeys: string[],
  itemIndexByKey: Map<string, number>,
): CompactRelay[] {
  return relays
    .map((relay) => [
      compactStringIndexes(relay.itemKeys, itemKeys, itemIndexByKey),
    ] satisfies CompactRelay)
    .filter(([relayItemIndexes]) => relayItemIndexes.length);
}

function compactLayoutIconIds(
  iconIds: string[],
  itemKeys: string[],
  itemIndexByKey: Map<string, number>,
): CompactLayoutIconIds {
  return compactOrderedStringIndexes(iconIds, itemKeys, itemIndexByKey);
}

function parseCompactState(
  value: Record<string, unknown>,
  options: LayoutUrlCodecOptions,
): ParsedLayoutUrlState {
  const installedRecipeIds = parseCompactInstalledRecipeIds(value.i);
  const recipeIds = parseRecipeDictionary(
    value.r,
    (recipeId) => options.isRecipeIdAllowed(recipeId) || installedRecipeIds.has(recipeId),
  );
  const itemKeys = parseStringDictionary(value.g);
  const seenLayoutIds = new Set<string>();
  const installedRecipes = parseCompactInstalledRecipes(
    value.i,
    recipeIds,
    itemKeys,
    options,
    seenLayoutIds,
  );
  const layouts = Array.isArray(value.l)
    ? value.l.flatMap((rawLayout, index) =>
        parseCompactLayout(
          rawLayout,
          index === 0 ? options.defaultLayoutId : `layout-${index + 1}`,
          recipeIds,
          itemKeys,
          options,
          seenLayoutIds,
        ),
      )
    : [];

  if (!layouts.length) {
    return {
      ...defaultCompactLayoutState(options.defaultLayoutId),
      installedRecipes,
    };
  }

  const focusedLayoutIndex = parseNonNegativeInteger(value.f);
  const focusedLayoutId =
    focusedLayoutIndex !== null && focusedLayoutIndex < layouts.length
      ? layouts[focusedLayoutIndex]?.id
      : layouts[0]?.id;

  return {
    focusedLayoutId: focusedLayoutId ?? layouts[0]?.id ?? options.defaultLayoutId,
    installedRecipes,
    layouts,
  };
}

function parseCompactInstalledRecipeIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    value.flatMap((rawInstalledRecipe) => {
      if (!Array.isArray(rawInstalledRecipe)) {
        return [];
      }

      const id = rawInstalledRecipe[0];

      return typeof id === "string" && id.startsWith(compositeRecipeIdPrefix)
        ? [id]
        : [];
    }),
  );
}

function parseCompactInstalledRecipes(
  value: unknown,
  recipeIds: Array<string | null>,
  itemKeys: Array<string | null>,
  options: LayoutUrlCodecOptions,
  seenLayoutIds: Set<string>,
): InstalledLayoutRecipe[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenInstalledRecipeIds = new Set<string>();

  return value.flatMap((rawInstalledRecipe, index) => {
    if (!Array.isArray(rawInstalledRecipe)) {
      return [];
    }

    const rawId = rawInstalledRecipe[0];
    const rawLayout = rawInstalledRecipe[1];

    if (
      typeof rawId !== "string" ||
      !rawId.startsWith(compositeRecipeIdPrefix) ||
      seenInstalledRecipeIds.has(rawId)
    ) {
      return [];
    }

    const layout = parseCompactLayout(
      rawLayout,
      `installed-${index + 1}`,
      recipeIds,
      itemKeys,
      options,
      seenLayoutIds,
    )[0];

    if (!layout) {
      return [];
    }

    seenInstalledRecipeIds.add(rawId);

    return [
      {
        id: rawId,
        layout,
        name: layout.name,
      },
    ];
  });
}

function parseRecipeDictionary(
  value: unknown,
  isRecipeIdAllowed: (recipeId: string) => boolean,
): Array<string | null> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rawRecipeId) =>
    typeof rawRecipeId === "string" && isRecipeIdAllowed(rawRecipeId)
      ? rawRecipeId
      : null,
  );
}

function parseStringDictionary(value: unknown): Array<string | null> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rawValue) => (typeof rawValue === "string" ? rawValue : null));
}

function parseCompactLayout(
  value: unknown,
  layoutIdBase: string,
  recipeIds: Array<string | null>,
  itemKeys: Array<string | null>,
  options: LayoutUrlCodecOptions,
  seenLayoutIds: Set<string>,
): RecipeLayout[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const layoutId = getUniqueId(layoutIdBase, seenLayoutIds);
  const { entries, entryIdByIndex } = parseCompactEntries(
    value[2],
    layoutId,
    recipeIds,
    options,
  );
  const { relays, relayIdByIndex } = parseCompactRelays(
    value[9],
    layoutId,
    entries.length,
    itemKeys,
  );
  const nodeIdByIndex = new Map([...entryIdByIndex, ...relayIdByIndex]);

  return [
    {
      id: layoutId,
      name: typeof value[0] === "string" ? value[0] : "",
      iconIds: parseCompactOrderedStringIndexes(value[10], itemKeys).slice(0, 4),
      entries,
      relays,
      graphPositions: parseCompactGraphPositions(value[3], nodeIdByIndex),
      edgePorts: parseCompactGraphEdgePorts(value[4], nodeIdByIndex),
      edgeRoutes: parseCompactGraphEdgeRoutes(value[5], nodeIdByIndex),
      terminalSides: parseCompactGraphTerminalSides(value[6], nodeIdByIndex),
      edgeItems: parseCompactGraphEdgeItems(value[7], nodeIdByIndex, itemKeys),
      externalItems: parseCompactGraphExternalItems(value[8], nodeIdByIndex, itemKeys),
      collapsed: value[1] === 1 || value[1] === true,
    },
  ];
}

function parseCompactEntries(
  value: unknown,
  layoutId: string,
  recipeIds: Array<string | null>,
  options: LayoutUrlCodecOptions,
): { entries: RecipeLayoutEntry[]; entryIdByIndex: Map<number, string> } {
  const entries: RecipeLayoutEntry[] = [];
  const entryIdByIndex = new Map<number, string>();

  if (!Array.isArray(value)) {
    return { entries, entryIdByIndex };
  }

  value.forEach((rawEntry, entryIndex) => {
    const rawRecipeIndex = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;
    const rawProductionSize = Array.isArray(rawEntry) ? rawEntry[1] : undefined;
    const rawMachineId = Array.isArray(rawEntry) ? rawEntry[2] : undefined;
    const rawFactorySettings = Array.isArray(rawEntry) ? rawEntry[3] : undefined;
    const recipeIndex = parseNonNegativeInteger(rawRecipeIndex);
    const recipeId = recipeIndex === null ? null : recipeIds[recipeIndex] ?? null;

    if (!recipeId) {
      return;
    }

    const entryId = `${layoutId}-entry-${entryIndex + 1}`;
    const machineId =
      typeof rawMachineId === "string" &&
      options.isRecipeMachineIdAllowed(recipeId, rawMachineId)
        ? rawMachineId
        : null;

    entries.push({
      id: entryId,
      ...(machineId ? { machineId } : {}),
      ...parseCompactFactorySettings(rawFactorySettings),
      productionSize: parseProductionSize(rawProductionSize),
      recipeId,
    });
    entryIdByIndex.set(entryIndex, entryId);
  });

  return { entries, entryIdByIndex };
}

function parseCompactFactorySettings(
  value: unknown,
): Pick<RecipeLayoutEntry, "beacons" | "modules"> {
  if (!isRecord(value)) {
    return {};
  }

  const modules = parseCompactModuleSettings(value.u);
  const beacons = parseCompactBeaconSettings(value.b);

  return {
    ...(beacons.length ? { beacons } : {}),
    ...(modules.length ? { modules } : {}),
  };
}

function parseCompactModuleSettings(value: unknown): LayoutModuleSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((rawSetting) => {
    if (!Array.isArray(rawSetting)) {
      return [];
    }

    const id = rawSetting[0];
    const count = rawSetting[1];

    return typeof id === "string" && typeof count === "number"
      ? [{ id, count: parseFactorySettingCount(count) }]
      : [];
  });
}

function parseCompactBeaconSettings(value: unknown): LayoutBeaconSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((rawSetting) => {
    if (!Array.isArray(rawSetting)) {
      return [];
    }

    const id = rawSetting[0];
    const count = rawSetting[1];

    return typeof id === "string" && typeof count === "number"
      ? [
          {
            id,
            count: parseFactorySettingCount(count),
            modules: parseCompactModuleSettings(rawSetting[2]),
          },
        ]
      : [];
  });
}

function parseCompactRelays(
  value: unknown,
  layoutId: string,
  entryCount: number,
  itemKeys: Array<string | null>,
): { relays: GraphRelay[]; relayIdByIndex: Map<number, string> } {
  const relays: GraphRelay[] = [];
  const relayIdByIndex = new Map<number, string>();

  if (!Array.isArray(value)) {
    return { relays, relayIdByIndex };
  }

  value.forEach((rawRelay, relayIndex) => {
    if (!Array.isArray(rawRelay)) {
      return;
    }

    const relayItemKeys = parseCompactStringIndexes(rawRelay[0], itemKeys);

    if (!relayItemKeys.length) {
      return;
    }

    const relayId = `${layoutId}-relay-${relayIndex + 1}`;
    const nodeIndex = entryCount + relayIndex;

    relays.push({ id: relayId, itemKeys: relayItemKeys });
    relayIdByIndex.set(nodeIndex, relayId);
  });

  return { relays, relayIdByIndex };
}

function parseCompactGraphPositions(
  value: unknown,
  entryIdByIndex: Map<number, string>,
): Record<string, GraphNodePosition> {
  const graphPositions: Record<string, GraphNodePosition> = {};

  if (!Array.isArray(value)) {
    return graphPositions;
  }

  for (const rawPosition of value) {
    if (!Array.isArray(rawPosition)) {
      continue;
    }

    const entryIndex = parseNonNegativeInteger(rawPosition[0]);
    const entryId = entryIndex === null ? undefined : entryIdByIndex.get(entryIndex);
    const point = parseGraphPoint(rawPosition[1], rawPosition[2]);

    if (entryId && point) {
      graphPositions[entryId] = point;
    }
  }

  return graphPositions;
}

function parseCompactGraphEdgePorts(
  value: unknown,
  entryIdByIndex: Map<number, string>,
): Record<string, GraphEdgePorts> {
  const edgePorts: Record<string, GraphEdgePorts> = {};

  if (!Array.isArray(value)) {
    return edgePorts;
  }

  for (const rawPorts of value) {
    if (!Array.isArray(rawPorts)) {
      continue;
    }

    const edge = parseCompactEdgeIndexes(rawPorts[0], rawPorts[1], entryIdByIndex);
    const sourceSide = decodeGraphSide(rawPorts[2]);
    const targetSide = decodeGraphSide(rawPorts[3]);

    if (edge && sourceSide && targetSide) {
      edgePorts[getGraphEdgeId(edge.sourceId, edge.targetId)] = {
        sourceSide,
        targetSide,
      };
    }
  }

  return edgePorts;
}

function parseCompactGraphEdgeRoutes(
  value: unknown,
  entryIdByIndex: Map<number, string>,
): Record<string, GraphEdgeRoute> {
  const edgeRoutes: Record<string, GraphEdgeRoute> = {};

  if (!Array.isArray(value)) {
    return edgeRoutes;
  }

  for (const rawRoute of value) {
    if (!Array.isArray(rawRoute)) {
      continue;
    }

    const edge = parseCompactEdgeIndexes(rawRoute[0], rawRoute[1], entryIdByIndex);
    const point = parseGraphPoint(rawRoute[2], rawRoute[3]);

    if (edge && point) {
      edgeRoutes[getGraphEdgeId(edge.sourceId, edge.targetId)] = point;
    }
  }

  return edgeRoutes;
}

function parseCompactGraphTerminalSides(
  value: unknown,
  entryIdByIndex: Map<number, string>,
): Record<string, GraphSide> {
  const terminalSides: Record<string, GraphSide> = {};

  if (!Array.isArray(value)) {
    return terminalSides;
  }

  for (const rawTerminal of value) {
    if (!Array.isArray(rawTerminal)) {
      continue;
    }

    const entryIndex = parseNonNegativeInteger(rawTerminal[0]);
    const entryId = entryIndex === null ? undefined : entryIdByIndex.get(entryIndex);
    const kind = decodeGraphTerminalKind(rawTerminal[1]);
    const side = decodeGraphSide(rawTerminal[2]);

    if (entryId && kind && side) {
      terminalSides[getGraphTerminalId(entryId, kind)] = side;
    }
  }

  return terminalSides;
}

function parseCompactGraphEdgeItems(
  value: unknown,
  entryIdByIndex: Map<number, string>,
  itemKeys: Array<string | null>,
): Record<string, string[]> {
  const edgeItems: Record<string, string[]> = {};

  if (!Array.isArray(value)) {
    return edgeItems;
  }

  for (const rawEdgeItems of value) {
    if (!Array.isArray(rawEdgeItems)) {
      continue;
    }

    const edge = parseCompactEdgeIndexes(rawEdgeItems[0], rawEdgeItems[1], entryIdByIndex);

    if (edge) {
      edgeItems[getGraphEdgeId(edge.sourceId, edge.targetId)] = parseCompactStringIndexes(
        rawEdgeItems[2],
        itemKeys,
      );
    }
  }

  return edgeItems;
}

function parseCompactGraphExternalItems(
  value: unknown,
  entryIdByIndex: Map<number, string>,
  itemKeys: Array<string | null>,
): Record<string, string[]> {
  const externalItems: Record<string, string[]> = {};

  if (!Array.isArray(value)) {
    return externalItems;
  }

  for (const rawExternalItems of value) {
    if (!Array.isArray(rawExternalItems)) {
      continue;
    }

    const entryIndex = parseNonNegativeInteger(rawExternalItems[0]);
    const entryId = entryIndex === null ? undefined : entryIdByIndex.get(entryIndex);
    const kind = decodeGraphTerminalKind(rawExternalItems[1]);
    const itemKeyList = parseCompactStringIndexes(rawExternalItems[2], itemKeys);

    if (entryId && kind && itemKeyList.length) {
      externalItems[getGraphTerminalId(entryId, kind)] = itemKeyList;
    }
  }

  return externalItems;
}

function parseCompactEdgeIndexes(
  rawSourceIndex: unknown,
  rawTargetIndex: unknown,
  entryIdByIndex: Map<number, string>,
): { sourceId: string; targetId: string } | null {
  const sourceIndex = parseNonNegativeInteger(rawSourceIndex);
  const targetIndex = parseNonNegativeInteger(rawTargetIndex);
  const sourceId = sourceIndex === null ? undefined : entryIdByIndex.get(sourceIndex);
  const targetId = targetIndex === null ? undefined : entryIdByIndex.get(targetIndex);

  return sourceId && targetId ? { sourceId, targetId } : null;
}

function parseGraphPoint(rawX: unknown, rawY: unknown): GraphEdgeRoute | null {
  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return null;
  }

  return {
    x: Math.round(rawX),
    y: Math.round(rawY),
  };
}

function defaultCompactLayoutState(defaultLayoutId: string): ParsedLayoutUrlState {
  return {
    focusedLayoutId: defaultLayoutId,
    installedRecipes: [],
    layouts: [
      {
        id: defaultLayoutId,
        name: "",
        iconIds: [],
        entries: [],
        relays: [],
        graphPositions: {},
        edgePorts: {},
        edgeRoutes: {},
        edgeItems: {},
        externalItems: {},
        terminalSides: {},
        collapsed: false,
      },
    ],
  };
}

function getRecipeIndex(
  recipeId: string,
  recipeIds: string[],
  recipeIndexById: Map<string, number>,
): number {
  return getStringIndex(recipeId, recipeIds, recipeIndexById);
}

function getStringIndex(
  value: string,
  values: string[],
  indexByValue: Map<string, number>,
): number {
  const existingIndex = indexByValue.get(value);

  if (existingIndex !== undefined) {
    return existingIndex;
  }

  const index = values.length;

  values.push(value);
  indexByValue.set(value, index);
  return index;
}

function compactStringIndexes(
  values: string[],
  stringValues: string[],
  indexByValue: Map<string, number>,
): number[] {
  return uniqueStrings(values).map((value) =>
    getStringIndex(value, stringValues, indexByValue),
  );
}

function compactOrderedStringIndexes(
  values: string[],
  stringValues: string[],
  indexByValue: Map<string, number>,
): number[] {
  return uniqueOrderedStrings(values).map((value) =>
    getStringIndex(value, stringValues, indexByValue),
  );
}

function parseCompactStringIndexes(
  value: unknown,
  stringValues: Array<string | null>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value.flatMap((rawIndex) => {
      const index = parseNonNegativeInteger(rawIndex);
      const stringValue = index === null ? null : stringValues[index] ?? null;

      return stringValue ? [stringValue] : [];
    }),
  );
}

function parseCompactOrderedStringIndexes(
  value: unknown,
  stringValues: Array<string | null>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueOrderedStrings(
    value.flatMap((rawIndex) => {
      const index = parseNonNegativeInteger(rawIndex);
      const stringValue = index === null ? null : stringValues[index] ?? null;

      return stringValue ? [stringValue] : [];
    }),
  );
}

function parseProductionSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? normalizeProductionSize(value)
    : defaultProductionSize;
}

function normalizeProductionSize(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 1_000_000) / 1_000_000
    : defaultProductionSize;
}

function normalizeFactorySettingCount(value: number): number | null {
  return Number.isFinite(value) && value >= 0
    ? Math.round(value * 1_000_000) / 1_000_000
    : null;
}

function parseFactorySettingCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 1_000_000) / 1_000_000
    : 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueOrderedStrings(values: string[]): string[] {
  const seenValues = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function setCompactSlot(compact: unknown[], index: number, value: unknown[]) {
  if (!value.length) {
    return;
  }

  while (compact.length < index) {
    compact.push(null);
  }

  compact[index] = value;
}

function encodeGraphSide(side: GraphSide): GraphSideCode | null {
  const sideCode = graphSides.indexOf(side);

  return sideCode === -1 ? null : (sideCode as GraphSideCode);
}

function decodeGraphSide(value: unknown): GraphSide | null {
  const sideCode = parseNonNegativeInteger(value);

  return sideCode === null ? null : graphSides[sideCode] ?? null;
}

function encodeGraphTerminalKind(kind: GraphTerminalKind): GraphTerminalKindCode {
  return kind === "input" ? 0 : 1;
}

function decodeGraphTerminalKind(value: unknown): GraphTerminalKind | null {
  if (value === 0) {
    return "input";
  }

  if (value === 1) {
    return "output";
  }

  return null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function getGraphEdgeId(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function parseGraphEdgeId(edgeId: string): { sourceId: string; targetId: string } | null {
  const separator = edgeId.indexOf("->");

  if (separator <= 0 || separator >= edgeId.length - 2) {
    return null;
  }

  return {
    sourceId: edgeId.slice(0, separator),
    targetId: edgeId.slice(separator + 2),
  };
}

function getGraphTerminalId(entryId: string, kind: GraphTerminalKind): string {
  return `${entryId}:${kind}`;
}

function parseGraphTerminalId(
  terminalId: string,
): { entryId: string; kind: GraphTerminalKind } | null {
  const separator = terminalId.lastIndexOf(":");

  if (separator <= 0 || separator >= terminalId.length - 1) {
    return null;
  }

  const kind = terminalId.slice(separator + 1);

  if (kind !== "input" && kind !== "output") {
    return null;
  }

  return {
    entryId: terminalId.slice(0, separator),
    kind,
  };
}

function getUniqueId(id: string, seenIds: Set<string>): string {
  if (!seenIds.has(id)) {
    seenIds.add(id);
    return id;
  }

  let suffix = 2;
  let nextId = `${id}-${suffix}`;

  while (seenIds.has(nextId)) {
    suffix += 1;
    nextId = `${id}-${suffix}`;
  }

  seenIds.add(nextId);
  return nextId;
}

function compareFirstNumber(left: { 0?: number }, right: { 0?: number }): number {
  return (left[0] ?? 0) - (right[0] ?? 0);
}

function compareFirstTwoNumbers(
  left: { 0?: number; 1?: number },
  right: { 0?: number; 1?: number },
): number {
  return (left[0] ?? 0) - (right[0] ?? 0) || (left[1] ?? 0) - (right[1] ?? 0);
}

function makeUriUnreserved(value: string): string {
  return value.replaceAll("+", "_").replaceAll("$", ".");
}

function restoreUriSafeAlphabet(value: string): string {
  return value.replaceAll("_", "+").replaceAll(".", "$");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
