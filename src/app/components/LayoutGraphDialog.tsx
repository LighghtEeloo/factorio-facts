import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from "lucide-react";
import {
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type OnNodeDrag,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeIconId,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import type {
  GraphEdgePorts,
  GraphNodePosition,
  GraphSide,
  RecipeLayout,
  RecipeLayoutEntry,
} from "../types";
import { IconSprite } from "./IconSprite";

const graphColumnGap = 310;
const graphBaseX = 96;
const graphBaseY = 88;
const graphRowGap = 170;
const graphSides = ["top", "right", "bottom", "left"] as const satisfies readonly GraphSide[];
const defaultGraphEdgePorts: GraphEdgePorts = {
  sourceSide: "right",
  targetSide: "left",
};

const nodeTypes = {
  recipe: RecipeNode,
} satisfies NodeTypes;

const edgeTypes = {
  "item-flow": ItemFlowEdge,
} satisfies EdgeTypes;

interface LayoutGraphDialogProps {
  data: RecipeExplorerData;
  layout: RecipeLayout;
  onClose(): void;
  onEdgePortsChange(edgeId: string, ports: GraphEdgePorts): void;
  onNodePositionChange(entryId: string, position: GraphNodePosition): void;
  onResetGraphPositions(): void;
  onSelectItem(itemId: string): void;
}

export function LayoutGraphDialog({
  data,
  layout,
  onClose,
  onEdgePortsChange,
  onNodePositionChange,
  onResetGraphPositions,
  onSelectItem,
}: LayoutGraphDialogProps) {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const graph = useMemo(
    () => buildLayoutGraph(data, layout, onSelectItem, setSelectedEdgeId),
    [data, layout, onSelectItem],
  );
  const [nodes, setNodes] = useState<RecipeFlowNode[]>(graph.nodes);
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        selected: edge.id === selectedEdgeId,
      })),
    [graph.edges, selectedEdgeId],
  );
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const graphNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          endpointSelector: getEndpointSelectorForNode(
            node.id,
            selectedEdge,
            onEdgePortsChange,
          ),
        },
      })),
    [nodes, onEdgePortsChange, selectedEdge],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasSavedGraphState =
    Object.keys(layout.graphPositions).length > 0 ||
    Object.keys(layout.edgePorts).length > 0;
  const title = layout.name.trim() || "Untitled layout";

  useEffect(() => {
    setNodes(graph.nodes);
  }, [graph.nodes]);

  useEffect(() => {
    if (selectedEdgeId && !graph.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [graph.edges, selectedEdgeId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleNodesChange = useCallback((changes: NodeChange<RecipeFlowNode>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const handleNodeDragStop = useCallback<OnNodeDrag<RecipeFlowNode>>(
    (_event, node) => {
      onNodePositionChange(node.id, node.position);
    },
    [onNodePositionChange],
  );

  return (
    <div
      className={`layout-graph-backdrop ${isFullscreen ? "popup-backdrop--fullscreen" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="layout-graph-title"
        aria-modal="true"
        className={`layout-graph-dialog app-panel ${isFullscreen ? "popup-dialog--fullscreen" : ""}`}
        role="dialog"
      >
        <header className="layout-graph-dialog__header">
          <div>
            <h2 id="layout-graph-title">{title}</h2>
            <span>
              {layout.entries.length} {layout.entries.length === 1 ? "recipe" : "recipes"}
            </span>
          </div>
          <div className="popup-header-actions">
            <button
              aria-label="Reset layout graph"
              className="icon-button"
              data-tooltip="Reset graph"
              disabled={!hasSavedGraphState}
              type="button"
              onClick={onResetGraphPositions}
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <button
              aria-label={
                isFullscreen ? "Exit fullscreen layout graph" : "Fullscreen layout graph"
              }
              aria-pressed={isFullscreen}
              className="icon-button"
              data-tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
            >
              {isFullscreen ? (
                <Minimize2 size={18} aria-hidden="true" />
              ) : (
                <Maximize2 size={18} aria-hidden="true" />
              )}
            </button>
            <button
              aria-label="Close layout graph"
              className="icon-button"
              data-tooltip="Close"
              type="button"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {nodes.length ? (
          <div className="layout-graph-flow-shell">
            <ReactFlow<RecipeFlowNode, ItemFlowEdgeType>
              colorMode="dark"
              defaultEdgeOptions={{
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "#d7b65f",
                },
              }}
              edges={edges}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.25}
              nodes={graphNodes}
              nodeTypes={nodeTypes}
              nodesConnectable={false}
              onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
              onNodeClick={() => setSelectedEdgeId(null)}
              onNodeDragStop={handleNodeDragStop}
              onNodesChange={handleNodesChange}
              onPaneClick={() => setSelectedEdgeId(null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#4b4735" gap={34} />
              <Controls showInteractive={false} />
              <MiniMap
                maskColor="rgba(12, 13, 10, 0.62)"
                nodeColor="#d7b65f"
                pannable
                style={{ width: 100, height: 75 }}
                zoomable
              />
            </ReactFlow>
          </div>
        ) : (
          <div className="empty-state">Add recipes to this layout to graph them</div>
        )}
      </section>
    </div>
  );
}

interface RecipeNodeData extends Record<string, unknown> {
  data: RecipeExplorerData;
  endpointSelector?: GraphEndpointSelector | null;
  externalInputs: IngredientPrototype[];
  externalOutputs: ProductPrototype[];
  onSelectItem(itemId: string): void;
  recipe: RecipePrototype;
}

interface GraphEndpointSelector {
  activeSide: GraphSide;
  kind: "source" | "target";
  onSelectSide(side: GraphSide): void;
}

type RecipeFlowNode = Node<RecipeNodeData, "recipe">;

function RecipeNode({ data }: NodeProps<RecipeFlowNode>) {
  const metadata = getRecipeMetadata(data.recipe);
  const icon = data.data.iconById.get(getRecipeIconId(data.recipe));
  const endpointSelector = data.endpointSelector;

  return (
    <article className="layout-graph-node">
      {graphSides.map((side) => (
        <Handle
          className={`layout-graph-handle layout-graph-handle--${side}`}
          id={getGraphHandleId("target", side)}
          key={`target-${side}`}
          position={getGraphHandlePosition(side)}
          type="target"
        />
      ))}
      {graphSides.map((side) => (
        <Handle
          className={`layout-graph-handle layout-graph-handle--${side}`}
          id={getGraphHandleId("source", side)}
          key={`source-${side}`}
          position={getGraphHandlePosition(side)}
          type="source"
        />
      ))}
      {endpointSelector ? (
        <div
          className={`layout-graph-endpoints layout-graph-endpoints--${endpointSelector.kind}`}
        >
          {graphSides.map((side) => (
            <button
              aria-label={`Attach ${endpointSelector.kind === "source" ? "start" : "end"} to ${metadata.name} ${side}`}
              aria-pressed={endpointSelector.activeSide === side}
              className={`layout-graph-endpoint-button layout-graph-endpoint-button--${side} nodrag nopan`}
              data-tooltip={`${endpointSelector.kind === "source" ? "Start" : "End"} ${side}`}
              key={side}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                endpointSelector.onSelectSide(side);
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <span />
            </button>
          ))}
        </div>
      ) : null}

      <div className="layout-graph-node__ports layout-graph-node__ports--in">
        {data.externalInputs.map((entry) => (
          <GraphItemToken
            data={data.data}
            entry={entry}
            key={`in-${entry.type}:${entry.name}`}
            onSelectItem={data.onSelectItem}
          />
        ))}
      </div>

      <div className="layout-graph-node__main">
        <IconSprite
          atlas={data.data.atlas}
          icon={icon}
          label={metadata.name}
          size={30}
        />
        <div>
          <h3>{metadata.name}</h3>
          <span>{metadata.id}</span>
        </div>
      </div>

      <div className="layout-graph-node__ports layout-graph-node__ports--out">
        {data.externalOutputs.map((entry) => (
          <GraphItemToken
            data={data.data}
            entry={entry}
            key={`out-${entry.type}:${entry.name}`}
            onSelectItem={data.onSelectItem}
          />
        ))}
      </div>
    </article>
  );
}

interface ItemFlowEdgeData extends Record<string, unknown> {
  data: RecipeExplorerData;
  items: ProductPrototype[];
  onFocusEdge(edgeId: string): void;
  ports: GraphEdgePorts;
  sourceName: string;
  targetName: string;
}

type ItemFlowEdgeType = Edge<ItemFlowEdgeData, "item-flow">;

function getEndpointSelectorForNode(
  nodeId: string,
  edge: ItemFlowEdgeType | null,
  onEdgePortsChange: (edgeId: string, ports: GraphEdgePorts) => void,
): GraphEndpointSelector | null {
  if (!edge?.data) {
    return null;
  }

  const ports = edge.data.ports;

  if (nodeId === edge.source) {
    return {
      activeSide: ports.sourceSide,
      kind: "source",
      onSelectSide: (sourceSide) =>
        onEdgePortsChange(edge.id, {
          ...ports,
          sourceSide,
        }),
    };
  }

  if (nodeId === edge.target) {
    return {
      activeSide: ports.targetSide,
      kind: "target",
      onSelectSide: (targetSide) =>
        onEdgePortsChange(edge.id, {
          ...ports,
          targetSide,
        }),
    };
  }

  return null;
}

function ItemFlowEdge({
  data,
  id,
  markerEnd,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<ItemFlowEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edgeData = data;

  return (
    <>
      <BaseEdge
        className={`layout-graph-edge ${selected ? "layout-graph-edge--selected" : ""}`}
        id={id}
        path={path}
        {...(markerEnd ? { markerEnd } : {})}
      />
      {edgeData ? (
        <EdgeLabelRenderer>
          <button
            aria-label={`Focus edge from ${edgeData.sourceName} to ${edgeData.targetName}`}
            className={`layout-graph-edge-label nodrag nopan ${
              selected ? "layout-graph-edge-label--selected" : ""
            }`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              edgeData.onFocusEdge(id);
            }}
            onFocus={() => edgeData.onFocusEdge(id)}
          >
            {edgeData.items.slice(0, 3).map((entry) => (
              <GraphItemToken
                data={edgeData.data}
                entry={entry}
                key={`${id}-${entry.type}:${entry.name}`}
              />
            ))}
            {edgeData.items.length > 3 ? (
              <span className="layout-graph-more">+{edgeData.items.length - 3}</span>
            ) : null}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

interface GraphItemTokenProps {
  data: RecipeExplorerData;
  entry: IngredientPrototype | ProductPrototype;
  onSelectItem?: (itemId: string) => void;
}

function GraphItemToken({ data, entry, onSelectItem }: GraphItemTokenProps) {
  const item = data.itemById.get(entry.name);
  const label = item?.name ?? formatId(entry.name);
  const icon = item ? data.iconById.get(getIconIdForItem(item)) : data.iconById.get(entry.name);
  const content = <IconSprite atlas={data.atlas} icon={icon} label={label} size={22} />;

  if (!item || !onSelectItem) {
    return (
      <span
        aria-label={label}
        className="layout-graph-token layout-graph-token--static nodrag nopan"
        data-tooltip={`${label} (${entry.name})`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      aria-label={label}
      className="layout-graph-token nodrag nopan"
      data-tooltip={`${label} (${entry.name})`}
      type="button"
      onClick={() => onSelectItem(item.id)}
    >
      {content}
    </button>
  );
}

interface GraphNodeModel {
  id: string;
  entry: RecipeLayoutEntry;
  recipe: RecipePrototype;
  externalInputs: IngredientPrototype[];
  externalOutputs: ProductPrototype[];
  rank: number;
  sortKey: string;
  position: GraphNodePosition;
}

interface GraphEdgeDraft {
  id: string;
  sourceId: string;
  targetId: string;
  items: ProductPrototype[];
}

interface LayoutGraphModel {
  edges: ItemFlowEdgeType[];
  nodes: RecipeFlowNode[];
}

function buildLayoutGraph(
  data: RecipeExplorerData,
  layout: RecipeLayout,
  onSelectItem: (itemId: string) => void,
  onFocusEdge: (edgeId: string) => void,
): LayoutGraphModel {
  const entries = getGraphEntries(data, layout);
  const graphNodes: GraphNodeModel[] = entries.map(({ entry, recipe, sortKey }) => ({
    id: entry.id,
    entry,
    recipe,
    externalInputs: [],
    externalOutputs: [],
    rank: 0,
    sortKey,
    position: { x: 0, y: 0 },
  }));
  const edgeDrafts = buildGraphEdgeDrafts(graphNodes);

  assignNodeRanks(graphNodes, edgeDrafts);
  positionGraphNodes(graphNodes, layout.graphPositions);
  attachExternalItems(graphNodes);

  return {
    edges: buildFlowEdges(data, graphNodes, edgeDrafts, layout.edgePorts, onFocusEdge),
    nodes: graphNodes.map((node) => ({
      id: node.id,
      type: "recipe",
      position: node.position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        data,
        externalInputs: node.externalInputs,
        externalOutputs: node.externalOutputs,
        onSelectItem,
        recipe: node.recipe,
      },
    })),
  };
}

interface GraphEntry {
  entry: RecipeLayoutEntry;
  recipe: RecipePrototype;
  sortKey: string;
}

function getGraphEntries(
  data: RecipeExplorerData,
  layout: RecipeLayout,
): GraphEntry[] {
  return layout.entries
    .flatMap((entry) => {
      const recipe = data.recipeById.get(entry.recipeId);

      if (!recipe) {
        return [];
      }

      return [
        {
          entry,
          recipe,
          sortKey: `${getRecipeSortKey(recipe)}:${entry.id}`,
        },
      ];
    })
    .sort(compareGraphEntries);
}

function buildGraphEdgeDrafts(nodes: GraphNodeModel[]): GraphEdgeDraft[] {
  const edges: GraphEdgeDraft[] = [];

  for (const source of nodes) {
    const results = source.recipe.results ?? [];

    for (const target of nodes) {
      if (target.id === source.id) {
        continue;
      }

      const ingredients = target.recipe.ingredients ?? [];
      const items = uniqueProducts(
        results.filter((result) =>
          ingredients.some((ingredient) => sameEntity(result, ingredient)),
        ),
      );

      if (!items.length) {
        continue;
      }

      edges.push({
        id: `${source.id}->${target.id}`,
        sourceId: source.id,
        targetId: target.id,
        items,
      });
    }
  }

  return edges.sort((left, right) => left.id.localeCompare(right.id));
}

function assignNodeRanks(nodes: GraphNodeModel[], edges: GraphEdgeDraft[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoingEdges = new Map<string, GraphEdgeDraft[]>();
  const incomingCounts = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    outgoingEdges.set(edge.sourceId, [...(outgoingEdges.get(edge.sourceId) ?? []), edge]);
    incomingCounts.set(edge.targetId, (incomingCounts.get(edge.targetId) ?? 0) + 1);
  }

  for (const edgeList of outgoingEdges.values()) {
    edgeList.sort((left, right) => {
      const leftNode = nodeById.get(left.targetId);
      const rightNode = nodeById.get(right.targetId);

      if (!leftNode || !rightNode) {
        return left.targetId.localeCompare(right.targetId);
      }

      return compareGraphNodes(leftNode, rightNode);
    });
  }

  const queue = nodes
    .filter((node) => (incomingCounts.get(node.id) ?? 0) === 0)
    .sort(compareGraphNodes);
  const visitedIds = new Set<string>();

  while (queue.length) {
    const node = queue.shift();

    if (!node) {
      break;
    }

    visitedIds.add(node.id);

    for (const edge of outgoingEdges.get(node.id) ?? []) {
      const target = nodeById.get(edge.targetId);

      if (!target) {
        continue;
      }

      target.rank = Math.max(target.rank, node.rank + 1);
      incomingCounts.set(target.id, (incomingCounts.get(target.id) ?? 0) - 1);

      if ((incomingCounts.get(target.id) ?? 0) === 0) {
        insertSorted(queue, target, compareGraphNodes);
      }
    }
  }

  const cyclicNodes = nodes
    .filter((node) => !visitedIds.has(node.id))
    .sort(compareGraphNodes);

  for (const node of cyclicNodes) {
    const processedPredecessorRank = edges
      .filter((edge) => edge.targetId === node.id && visitedIds.has(edge.sourceId))
      .map((edge) => (nodeById.get(edge.sourceId)?.rank ?? 0) + 1);

    node.rank = Math.max(node.rank, ...processedPredecessorRank, 0);
  }
}

function positionGraphNodes(
  nodes: GraphNodeModel[],
  savedPositions: Record<string, GraphNodePosition>,
) {
  const nodesByRank = new Map<number, GraphNodeModel[]>();

  for (const node of nodes) {
    const rankNodes = nodesByRank.get(node.rank) ?? [];

    rankNodes.push(node);
    nodesByRank.set(node.rank, rankNodes);
  }

  const ranks = [...nodesByRank.keys()].sort((left, right) => left - right);

  ranks.forEach((rank, rankIndex) => {
    const rankNodes = (nodesByRank.get(rank) ?? []).sort(compareGraphNodes);

    rankNodes.forEach((node, rowIndex) => {
      node.position = savedPositions[node.id] ?? {
        x: graphBaseX + rankIndex * graphColumnGap,
        y: graphBaseY + rowIndex * graphRowGap,
      };
    });
  });
}

function attachExternalItems(nodes: GraphNodeModel[]) {
  for (const node of nodes) {
    const otherNodes = nodes.filter((candidate) => candidate.id !== node.id);

    node.externalInputs = uniqueIngredients(
      (node.recipe.ingredients ?? []).filter(
        (ingredient) =>
          !otherNodes.some((candidate) =>
            (candidate.recipe.results ?? []).some((result) =>
              sameEntity(result, ingredient),
            ),
          ),
      ),
    );
    node.externalOutputs = uniqueProducts(
      (node.recipe.results ?? []).filter(
        (result) =>
          !otherNodes.some((candidate) =>
            (candidate.recipe.ingredients ?? []).some((ingredient) =>
              sameEntity(result, ingredient),
            ),
          ),
      ),
    );
  }
}

function buildFlowEdges(
  data: RecipeExplorerData,
  nodes: GraphNodeModel[],
  edgeDrafts: GraphEdgeDraft[],
  edgePorts: Record<string, GraphEdgePorts>,
  onFocusEdge: (edgeId: string) => void,
): ItemFlowEdgeType[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edgeDrafts.map((edge) => ({
    ...buildFlowEdge(
      data,
      edge,
      nodeById,
      edgePorts[edge.id] ?? defaultGraphEdgePorts,
      onFocusEdge,
    ),
  }));
}

function buildFlowEdge(
  data: RecipeExplorerData,
  edge: GraphEdgeDraft,
  nodeById: Map<string, GraphNodeModel>,
  ports: GraphEdgePorts,
  onFocusEdge: (edgeId: string) => void,
): ItemFlowEdgeType {
  return {
    id: edge.id,
    type: "item-flow",
    source: edge.sourceId,
    target: edge.targetId,
    sourceHandle: getGraphHandleId("source", ports.sourceSide),
    targetHandle: getGraphHandleId("target", ports.targetSide),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#d7b65f",
    },
    data: {
      data,
      items: edge.items,
      onFocusEdge,
      ports,
      sourceName: getGraphNodeName(nodeById.get(edge.sourceId)),
      targetName: getGraphNodeName(nodeById.get(edge.targetId)),
    },
  };
}

function getGraphHandleId(kind: "source" | "target", side: GraphSide): string {
  return `${kind}-${side}`;
}

function getGraphHandlePosition(side: GraphSide): Position {
  switch (side) {
    case "top":
      return Position.Top;
    case "right":
      return Position.Right;
    case "bottom":
      return Position.Bottom;
    case "left":
      return Position.Left;
  }
}

function getGraphNodeName(node: GraphNodeModel | undefined): string {
  return node ? getRecipeMetadata(node.recipe).name : "Unknown recipe";
}

function compareGraphEntries(left: GraphEntry, right: GraphEntry): number {
  return left.sortKey.localeCompare(right.sortKey);
}

function compareGraphNodes(left: GraphNodeModel, right: GraphNodeModel): number {
  return left.sortKey.localeCompare(right.sortKey);
}

function getRecipeSortKey(recipe: RecipePrototype): string {
  const metadata = getRecipeMetadata(recipe);

  return `${metadata.name}:${metadata.id}`;
}

function insertSorted<T>(
  values: T[],
  value: T,
  compare: (left: T, right: T) => number,
) {
  const index = values.findIndex((existing) => compare(value, existing) < 0);

  if (index === -1) {
    values.push(value);
    return;
  }

  values.splice(index, 0, value);
}

function uniqueIngredients(entries: IngredientPrototype[]): IngredientPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueProducts(entries: ProductPrototype[]): ProductPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sameEntity(
  product: ProductPrototype,
  ingredient: IngredientPrototype,
): boolean {
  return product.type === ingredient.type && product.name === ingredient.name;
}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
