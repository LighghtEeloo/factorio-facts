import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type {
  GraphEdgePorts,
  GraphEdgeRoute,
  GraphNodePosition,
  GraphSide,
  GraphTerminalKind,
  RecipeLayout,
  RecipeLayoutEntry,
} from "./types";

const layoutStateBlobPrefix = "v1.";
const graphSides = ["top", "right", "bottom", "left"] as const satisfies readonly GraphSide[];
const defaultSourceSide: GraphSide = "right";
const defaultTargetSide: GraphSide = "left";
const defaultInputSide: GraphSide = "left";
const defaultOutputSide: GraphSide = "right";

type GraphSideCode = 0 | 1 | 2 | 3;
type GraphTerminalKindCode = 0 | 1;
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

export interface ParsedLayoutUrlState {
  focusedLayoutId: string;
  layouts: RecipeLayout[];
}

export interface LayoutUrlCodecOptions {
  defaultLayoutId: string;
  isRecipeIdAllowed(recipeId: string): boolean;
}

export function serializeCompactLayoutState(
  layouts: RecipeLayout[],
  focusedLayoutId: string,
): string {
  const recipeIndexById = new Map<string, number>();
  const recipeIds: string[] = [];

  for (const layout of layouts) {
    for (const entry of layout.entries) {
      getRecipeIndex(entry.recipeId, recipeIds, recipeIndexById);
    }
  }

  const focusedLayoutIndex = layouts.findIndex((layout) => layout.id === focusedLayoutId);
  const compactState: Record<string, unknown> = {
    r: recipeIds,
    l: layouts.map((layout) => compactLayout(layout, recipeIds, recipeIndexById)),
  };

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
): unknown[] {
  const entryIndexById = new Map(
    layout.entries.map((entry, index) => [entry.id, index] as const),
  );
  const compact: unknown[] = [
    layout.name,
    layout.collapsed ? 1 : 0,
    layout.entries.map((entry) =>
      getRecipeIndex(entry.recipeId, recipeIds, recipeIndexById),
    ),
  ];

  setCompactSlot(compact, 3, compactGraphPositions(layout.graphPositions, entryIndexById));
  setCompactSlot(compact, 4, compactGraphEdgePorts(layout.edgePorts, entryIndexById));
  setCompactSlot(compact, 5, compactGraphEdgeRoutes(layout.edgeRoutes, entryIndexById));
  setCompactSlot(compact, 6, compactGraphTerminalSides(layout.terminalSides, entryIndexById));

  return compact;
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

function parseCompactState(
  value: Record<string, unknown>,
  options: LayoutUrlCodecOptions,
): ParsedLayoutUrlState {
  const recipeIds = parseRecipeDictionary(value.r, options.isRecipeIdAllowed);
  const seenLayoutIds = new Set<string>();
  const layouts = Array.isArray(value.l)
    ? value.l.flatMap((rawLayout, index) =>
        parseCompactLayout(rawLayout, index, recipeIds, options, seenLayoutIds),
      )
    : [];

  if (!layouts.length) {
    return defaultCompactLayoutState(options.defaultLayoutId);
  }

  const focusedLayoutIndex = parseNonNegativeInteger(value.f);
  const focusedLayoutId =
    focusedLayoutIndex !== null && focusedLayoutIndex < layouts.length
      ? layouts[focusedLayoutIndex]?.id
      : layouts[0]?.id;

  return {
    focusedLayoutId: focusedLayoutId ?? layouts[0]?.id ?? options.defaultLayoutId,
    layouts,
  };
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

function parseCompactLayout(
  value: unknown,
  index: number,
  recipeIds: Array<string | null>,
  options: LayoutUrlCodecOptions,
  seenLayoutIds: Set<string>,
): RecipeLayout[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const layoutId = getUniqueId(
    index === 0 ? options.defaultLayoutId : `layout-${index + 1}`,
    seenLayoutIds,
  );
  const { entries, entryIdByIndex } = parseCompactEntries(value[2], layoutId, recipeIds);

  return [
    {
      id: layoutId,
      name: typeof value[0] === "string" ? value[0] : "",
      entries,
      graphPositions: parseCompactGraphPositions(value[3], entryIdByIndex),
      edgePorts: parseCompactGraphEdgePorts(value[4], entryIdByIndex),
      edgeRoutes: parseCompactGraphEdgeRoutes(value[5], entryIdByIndex),
      terminalSides: parseCompactGraphTerminalSides(value[6], entryIdByIndex),
      collapsed: value[1] === 1 || value[1] === true,
    },
  ];
}

function parseCompactEntries(
  value: unknown,
  layoutId: string,
  recipeIds: Array<string | null>,
): { entries: RecipeLayoutEntry[]; entryIdByIndex: Map<number, string> } {
  const entries: RecipeLayoutEntry[] = [];
  const entryIdByIndex = new Map<number, string>();

  if (!Array.isArray(value)) {
    return { entries, entryIdByIndex };
  }

  value.forEach((rawRecipeIndex, entryIndex) => {
    const recipeIndex = parseNonNegativeInteger(rawRecipeIndex);
    const recipeId = recipeIndex === null ? null : recipeIds[recipeIndex] ?? null;

    if (!recipeId) {
      return;
    }

    const entryId = `${layoutId}-entry-${entryIndex + 1}`;

    entries.push({ id: entryId, recipeId });
    entryIdByIndex.set(entryIndex, entryId);
  });

  return { entries, entryIdByIndex };
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
    layouts: [
      {
        id: defaultLayoutId,
        name: "",
        entries: [],
        graphPositions: {},
        edgePorts: {},
        edgeRoutes: {},
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
  const existingIndex = recipeIndexById.get(recipeId);

  if (existingIndex !== undefined) {
    return existingIndex;
  }

  const index = recipeIds.length;

  recipeIds.push(recipeId);
  recipeIndexById.set(recipeId, index);
  return index;
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

function compareFirstNumber(left: readonly number[], right: readonly number[]): number {
  return (left[0] ?? 0) - (right[0] ?? 0);
}

function compareFirstTwoNumbers(left: readonly number[], right: readonly number[]): number {
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
