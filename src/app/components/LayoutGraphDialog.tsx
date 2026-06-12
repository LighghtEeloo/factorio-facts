import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  useReactFlow,
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
  GraphEdgeRoute,
  GraphEdgePorts,
  GraphNodePosition,
  GraphSide,
  GraphTerminalKind,
  GraphTerminalSides,
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
const defaultGraphTerminalSides: GraphTerminalSides = {
  inputSide: "left",
  outputSide: "right",
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
  onEdgeRouteChange(edgeId: string, route: GraphEdgeRoute): void;
  onEdgeRouteReset(edgeId: string): void;
  onNodePositionChange(entryId: string, position: GraphNodePosition): void;
  onResetGraphPositions(): void;
  onSelectItem(itemId: string): void;
  onTerminalSideChange(terminalId: string, side: GraphSide): void;
}

export function LayoutGraphDialog({
  data,
  layout,
  onClose,
  onEdgePortsChange,
  onEdgeRouteChange,
  onEdgeRouteReset,
  onNodePositionChange,
  onResetGraphPositions,
  onSelectItem,
  onTerminalSideChange,
}: LayoutGraphDialogProps) {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const focusEdge = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedTerminalId(null);
  }, []);
  const focusTerminal = useCallback((terminalId: string) => {
    setSelectedTerminalId(terminalId);
    setSelectedEdgeId(null);
  }, []);
  const graph = useMemo(
    () =>
      buildLayoutGraph(
        data,
        layout,
        onSelectItem,
        focusEdge,
        onEdgeRouteChange,
        onEdgeRouteReset,
        focusTerminal,
        selectedTerminalId,
      ),
    [
      data,
      focusEdge,
      focusTerminal,
      layout,
      onEdgeRouteChange,
      onEdgeRouteReset,
      onSelectItem,
      selectedTerminalId,
    ],
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
  const selectedTerminal = useMemo(
    () => getSelectedTerminal(selectedTerminalId, graph.nodes),
    [graph.nodes, selectedTerminalId],
  );
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
            selectedTerminal,
            onTerminalSideChange,
          ),
        },
      })),
    [nodes, onEdgePortsChange, onTerminalSideChange, selectedEdge, selectedTerminal],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasSavedGraphState =
    Object.keys(layout.graphPositions).length > 0 ||
    Object.keys(layout.edgePorts).length > 0 ||
    Object.keys(layout.edgeRoutes).length > 0 ||
    Object.keys(layout.terminalSides).length > 0;
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
    if (selectedTerminalId && !getSelectedTerminal(selectedTerminalId, graph.nodes)) {
      setSelectedTerminalId(null);
    }
  }, [graph.nodes, selectedTerminalId]);

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
              onEdgeClick={(_event, edge) => focusEdge(edge.id)}
              onNodeClick={() => {
                setSelectedEdgeId(null);
                setSelectedTerminalId(null);
              }}
              onNodeDragStop={handleNodeDragStop}
              onNodesChange={handleNodesChange}
              onPaneClick={() => {
                setSelectedEdgeId(null);
                setSelectedTerminalId(null);
              }}
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
  onFocusTerminal(terminalId: string): void;
  onSelectItem(itemId: string): void;
  recipe: RecipePrototype;
  selectedTerminalId: string | null;
  terminalSides: GraphTerminalSides;
}

interface GraphEndpointSelector {
  activeSide: GraphSide;
  kind: "source" | "target" | "terminal-input" | "terminal-output";
  label: string;
  onSelectSide(side: GraphSide): void;
}

interface SelectedGraphTerminal {
  id: string;
  kind: GraphTerminalKind;
  nodeId: string;
  side: GraphSide;
}

type RecipeFlowNode = Node<RecipeNodeData, "recipe">;

function RecipeNode({ data, id }: NodeProps<RecipeFlowNode>) {
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
              aria-label={`Attach ${endpointSelector.label.toLowerCase()} to ${metadata.name} ${side}`}
              aria-pressed={endpointSelector.activeSide === side}
              className={`layout-graph-endpoint-button layout-graph-endpoint-button--${side} nodrag nopan`}
              data-tooltip={`${endpointSelector.label} ${side}`}
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

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalInputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "input")}
        kind="input"
        onFocusTerminal={data.onFocusTerminal}
        side={data.terminalSides.inputSide}
        terminalId={getGraphTerminalId(id, "input")}
      />

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

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalOutputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "output")}
        kind="output"
        onFocusTerminal={data.onFocusTerminal}
        side={data.terminalSides.outputSide}
        terminalId={getGraphTerminalId(id, "output")}
      />
    </article>
  );
}

interface ItemFlowEdgeData extends Record<string, unknown> {
  data: RecipeExplorerData;
  items: ProductPrototype[];
  onFocusEdge(edgeId: string): void;
  onRouteChange(edgeId: string, route: GraphEdgeRoute): void;
  onRouteReset(edgeId: string): void;
  ports: GraphEdgePorts;
  route: GraphEdgeRoute | null;
  sourceName: string;
  targetName: string;
}

type ItemFlowEdgeType = Edge<ItemFlowEdgeData, "item-flow">;

function getEndpointSelectorForNode(
  nodeId: string,
  edge: ItemFlowEdgeType | null,
  onEdgePortsChange: (edgeId: string, ports: GraphEdgePorts) => void,
  terminal: SelectedGraphTerminal | null,
  onTerminalSideChange: (terminalId: string, side: GraphSide) => void,
): GraphEndpointSelector | null {
  if (terminal && terminal.nodeId === nodeId) {
    return {
      activeSide: terminal.side,
      kind: terminal.kind === "input" ? "terminal-input" : "terminal-output",
      label: terminal.kind === "input" ? "External input" : "External output",
      onSelectSide: (side) => onTerminalSideChange(terminal.id, side),
    };
  }

  if (!edge?.data) {
    return null;
  }

  const ports = edge.data.ports;

  if (nodeId === edge.source) {
    return {
      activeSide: ports.sourceSide,
      kind: "source",
      label: "Start",
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
      label: "End",
      onSelectSide: (targetSide) =>
        onEdgePortsChange(edge.id, {
          ...ports,
          targetSide,
        }),
    };
  }

  return null;
}

function getSelectedTerminal(
  terminalId: string | null,
  nodes: RecipeFlowNode[],
): SelectedGraphTerminal | null {
  if (!terminalId) {
    return null;
  }

  const terminal = parseGraphTerminalId(terminalId);

  if (!terminal) {
    return null;
  }

  const node = nodes.find((candidate) => candidate.id === terminal.nodeId);

  if (!node) {
    return null;
  }

  const entries =
    terminal.kind === "input"
      ? node.data.externalInputs
      : node.data.externalOutputs;

  if (!entries.length) {
    return null;
  }

  return {
    id: terminalId,
    kind: terminal.kind,
    nodeId: terminal.nodeId,
    side:
      terminal.kind === "input"
        ? node.data.terminalSides.inputSide
        : node.data.terminalSides.outputSide,
  };
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
  const reactFlow = useReactFlow<RecipeFlowNode, ItemFlowEdgeType>();
  const dragMovedRef = useRef(false);
  const draggingPointerIdRef = useRef<number | null>(null);
  const lastRouteRef = useRef<GraphEdgeRoute | null>(null);
  const [draftRoute, setDraftRoute] = useState<GraphEdgeRoute | null>(null);
  const [isRouteDragging, setIsRouteDragging] = useState(false);
  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edgeData = data;
  const route = draftRoute ?? edgeData?.route ?? null;
  const path = route
    ? getRoutedEdgePath(
        sourceX,
        sourceY,
        sourcePosition,
        route,
        targetX,
        targetY,
        targetPosition,
      )
    : bezierPath;
  const labelX = route?.x ?? bezierLabelX;
  const labelY = route?.y ?? bezierLabelY;

  useEffect(() => {
    if (!isRouteDragging || !edgeData) {
      return;
    }

    const activeEdgeData = edgeData;

    function handlePointerMove(event: PointerEvent) {
      if (draggingPointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      dragMovedRef.current = true;
      const nextRoute = getRouteFromClientPoint(event.clientX, event.clientY);

      lastRouteRef.current = nextRoute;
      setDraftRoute(nextRoute);
    }

    function handlePointerEnd(event: PointerEvent) {
      if (draggingPointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const finalRoute = dragMovedRef.current
        ? lastRouteRef.current ?? getRouteFromClientPoint(event.clientX, event.clientY)
        : null;

      draggingPointerIdRef.current = null;
      dragMovedRef.current = false;
      lastRouteRef.current = null;
      setIsRouteDragging(false);

      if (finalRoute) {
        setDraftRoute(finalRoute);
        activeEdgeData.onRouteChange(id, finalRoute);
      }
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [edgeData, id, isRouteDragging, reactFlow]);

  useEffect(() => {
    if (isRouteDragging) {
      return;
    }

    setDraftRoute(null);
    setIsRouteDragging(false);
    dragMovedRef.current = false;
    draggingPointerIdRef.current = null;
    lastRouteRef.current = null;
  }, [edgeData?.route?.x, edgeData?.route?.y, id, isRouteDragging]);

  function getRouteFromClientPoint(clientX: number, clientY: number): GraphEdgeRoute {
    const position = reactFlow.screenToFlowPosition(
      {
        x: clientX,
        y: clientY,
      },
      { snapToGrid: false },
    );

    return {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
  }

  function startRouteDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!edgeData) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    edgeData.onFocusEdge(id);
    draggingPointerIdRef.current = event.pointerId;
    dragMovedRef.current = false;
    lastRouteRef.current = edgeData.route;
    setIsRouteDragging(true);
  }

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
            } ${isRouteDragging ? "layout-graph-edge-label--dragging" : ""}`}
            data-tooltip={selected ? "Drag to bend edge" : "Focus or drag edge"}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              edgeData.onFocusEdge(id);
            }}
            onFocus={() => edgeData.onFocusEdge(id)}
            onPointerDown={startRouteDrag}
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
          {selected && edgeData.route ? (
            <button
              aria-label={`Reset edge route from ${edgeData.sourceName} to ${edgeData.targetName}`}
              className="layout-graph-edge-route-reset nodrag nopan"
              data-tooltip="Reset edge route"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 34}px)`,
              }}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                edgeData.onFocusEdge(id);
                edgeData.onRouteReset(id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          ) : null}
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

interface GraphItemTokenProps {
  ariaPrefix?: string;
  data: RecipeExplorerData;
  entry: IngredientPrototype | ProductPrototype;
  onSelectItem?: (itemId: string) => void;
  tooltipPrefix?: string;
}

function GraphItemToken({
  ariaPrefix,
  data,
  entry,
  onSelectItem,
  tooltipPrefix,
}: GraphItemTokenProps) {
  const item = data.itemById.get(entry.name);
  const label = item?.name ?? formatId(entry.name);
  const icon = item ? data.iconById.get(getIconIdForItem(item)) : data.iconById.get(entry.name);
  const content = <IconSprite atlas={data.atlas} icon={icon} label={label} size={22} />;
  const ariaLabel = ariaPrefix ? `${ariaPrefix}: ${label}` : label;
  const tooltipLabel = tooltipPrefix
    ? `${tooltipPrefix}: ${label} (${entry.name})`
    : `${label} (${entry.name})`;

  if (!item || !onSelectItem) {
    return (
      <span
        aria-label={ariaLabel}
        className="layout-graph-token layout-graph-token--static nodrag nopan"
        data-tooltip={tooltipLabel}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className="layout-graph-token nodrag nopan"
      data-tooltip={tooltipLabel}
      type="button"
      onClick={() => onSelectItem(item.id)}
    >
      {content}
    </button>
  );
}

interface GraphBoundaryTerminalsProps {
  data: RecipeExplorerData;
  entries: Array<IngredientPrototype | ProductPrototype>;
  isFocused: boolean;
  kind: "input" | "output";
  onFocusTerminal(terminalId: string): void;
  side: GraphSide;
  terminalId: string;
}

function GraphBoundaryTerminals({
  data,
  entries,
  isFocused,
  kind,
  onFocusTerminal,
  side,
  terminalId,
}: GraphBoundaryTerminalsProps) {
  if (!entries.length) {
    return null;
  }

  const hiddenCount = Math.max(0, entries.length - 3);
  const labelKind = kind === "input" ? "External input" : "External output";
  const visibleEntries = entries.slice(0, 3);
  const overflowEntries = entries.slice(3);

  return (
    <div
      aria-label={`${labelKind}s`}
      aria-pressed={isFocused}
      className={`layout-graph-boundary layout-graph-boundary--${kind} layout-graph-boundary--side-${side} ${
        isFocused ? "layout-graph-boundary--focused" : ""
      } nodrag nopan`}
      data-tooltip={`Focus ${labelKind.toLowerCase()} terminals`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        event.currentTarget.focus();
        onFocusTerminal(terminalId);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onFocusTerminal(terminalId);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {visibleEntries.map((entry) => (
        <span
          className="layout-graph-boundary__item"
          key={`${kind}-${entry.type}:${entry.name}`}
        >
          <GraphItemToken
            ariaPrefix={labelKind}
            data={data}
            entry={entry}
            tooltipPrefix={labelKind}
          />
        </span>
      ))}
      {hiddenCount ? (
        <span
          aria-label={`${hiddenCount} more ${labelKind.toLowerCase()}s`}
          className="layout-graph-boundary-more nodrag nopan"
          data-tooltip={`${hiddenCount} more ${labelKind.toLowerCase()}s`}
        >
          +{hiddenCount}
        </span>
      ) : null}
      {overflowEntries.map((entry, index) => (
        <span
          className="layout-graph-boundary__item layout-graph-boundary__item--overflow"
          key={`${kind}-overflow-${entry.type}:${entry.name}`}
          style={{ "--overflow-offset": `${index * 30}px` } as CSSProperties}
        >
          <GraphItemToken
            ariaPrefix={labelKind}
            data={data}
            entry={entry}
            tooltipPrefix={labelKind}
          />
        </span>
      ))}
    </div>
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
  onEdgeRouteChange: (edgeId: string, route: GraphEdgeRoute) => void,
  onEdgeRouteReset: (edgeId: string) => void,
  onFocusTerminal: (terminalId: string) => void,
  selectedTerminalId: string | null,
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
    edges: buildFlowEdges(
      data,
      graphNodes,
      edgeDrafts,
      layout.edgePorts,
      layout.edgeRoutes,
      onFocusEdge,
      onEdgeRouteChange,
      onEdgeRouteReset,
    ),
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
        onFocusTerminal,
        onSelectItem,
        recipe: node.recipe,
        selectedTerminalId,
        terminalSides: {
          inputSide:
            layout.terminalSides[getGraphTerminalId(node.id, "input")] ??
            defaultGraphTerminalSides.inputSide,
          outputSide:
            layout.terminalSides[getGraphTerminalId(node.id, "output")] ??
            defaultGraphTerminalSides.outputSide,
        },
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
  edgeRoutes: Record<string, GraphEdgeRoute>,
  onFocusEdge: (edgeId: string) => void,
  onEdgeRouteChange: (edgeId: string, route: GraphEdgeRoute) => void,
  onEdgeRouteReset: (edgeId: string) => void,
): ItemFlowEdgeType[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edgeDrafts.map((edge) => ({
    ...buildFlowEdge(
      data,
      edge,
      nodeById,
      edgePorts[edge.id] ?? defaultGraphEdgePorts,
      edgeRoutes[edge.id] ?? null,
      onFocusEdge,
      onEdgeRouteChange,
      onEdgeRouteReset,
    ),
  }));
}

function buildFlowEdge(
  data: RecipeExplorerData,
  edge: GraphEdgeDraft,
  nodeById: Map<string, GraphNodeModel>,
  ports: GraphEdgePorts,
  route: GraphEdgeRoute | null,
  onFocusEdge: (edgeId: string) => void,
  onEdgeRouteChange: (edgeId: string, route: GraphEdgeRoute) => void,
  onEdgeRouteReset: (edgeId: string) => void,
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
      onRouteChange: onEdgeRouteChange,
      onRouteReset: onEdgeRouteReset,
      ports,
      route,
      sourceName: getGraphNodeName(nodeById.get(edge.sourceId)),
      targetName: getGraphNodeName(nodeById.get(edge.targetId)),
    },
  };
}

function getRoutedEdgePath(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  route: GraphEdgeRoute,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): string {
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const sourceDirection = getPositionVector(sourcePosition);
  const targetDirection = getPositionVector(targetPosition);
  const sourceDistance = getDistance(source, route);
  const targetDistance = getDistance(route, target);
  const sourceControlOffset = getEndpointControlOffset(
    source,
    route,
    sourcePosition,
    sourceDistance,
  );
  const targetControlOffset = getEndpointControlOffset(
    target,
    route,
    targetPosition,
    targetDistance,
  );
  const routeTangent = getRouteTangent(source, route, target);
  const routeSourceOffset = getRouteControlOffset(sourceDistance);
  const routeTargetOffset = getRouteControlOffset(targetDistance);
  const sourceControl = {
    x: source.x + sourceDirection.x * sourceControlOffset,
    y: source.y + sourceDirection.y * sourceControlOffset,
  };
  const routeEntryControl = {
    x: route.x - routeTangent.x * routeSourceOffset,
    y: route.y - routeTangent.y * routeSourceOffset,
  };
  const routeExitControl = {
    x: route.x + routeTangent.x * routeTargetOffset,
    y: route.y + routeTangent.y * routeTargetOffset,
  };
  const targetControl = {
    x: target.x + targetDirection.x * targetControlOffset,
    y: target.y + targetDirection.y * targetControlOffset,
  };

  return [
    `M ${source.x},${source.y}`,
    `C ${sourceControl.x},${sourceControl.y}`,
    `${routeEntryControl.x},${routeEntryControl.y}`,
    `${route.x},${route.y}`,
    `C ${routeExitControl.x},${routeExitControl.y}`,
    `${targetControl.x},${targetControl.y}`,
    `${target.x},${target.y}`,
  ].join(" ");
}

interface GraphPoint {
  x: number;
  y: number;
}

function getPositionVector(position: Position): GraphPoint {
  switch (position) {
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    case Position.Left:
      return { x: -1, y: 0 };
  }
}

function getEndpointControlOffset(
  endpoint: GraphPoint,
  route: GraphPoint,
  position: Position,
  distance: number,
): number {
  if (distance === 0) {
    return 0;
  }

  const axisDistance =
    position === Position.Left || position === Position.Right
      ? Math.abs(route.x - endpoint.x)
      : Math.abs(route.y - endpoint.y);
  const offset = Math.max(42, axisDistance * 0.55, distance * 0.24);

  return Math.min(220, offset, distance * 0.9);
}

function getRouteControlOffset(distance: number): number {
  if (distance === 0) {
    return 0;
  }

  return Math.min(160, Math.max(18, distance * 0.35), distance * 0.65);
}

function getRouteTangent(
  source: GraphPoint,
  route: GraphPoint,
  target: GraphPoint,
): GraphPoint {
  const incoming = normalizeVector(route.x - source.x, route.y - source.y);
  const outgoing = normalizeVector(target.x - route.x, target.y - route.y);
  const combined = normalizeVector(
    (incoming?.x ?? 0) + (outgoing?.x ?? 0),
    (incoming?.y ?? 0) + (outgoing?.y ?? 0),
  );

  return combined ?? outgoing ?? incoming ?? { x: 1, y: 0 };
}

function normalizeVector(x: number, y: number): GraphPoint | null {
  const length = Math.hypot(x, y);

  if (!length) {
    return null;
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function getDistance(left: GraphPoint, right: GraphPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function getGraphHandleId(kind: "source" | "target", side: GraphSide): string {
  return `${kind}-${side}`;
}

function getGraphTerminalId(entryId: string, kind: GraphTerminalKind): string {
  return `${entryId}:${kind}`;
}

function parseGraphTerminalId(
  terminalId: string,
): { nodeId: string; kind: GraphTerminalKind } | null {
  const separator = terminalId.lastIndexOf(":");

  if (separator <= 0 || separator >= terminalId.length - 1) {
    return null;
  }

  const kind = terminalId.slice(separator + 1);

  if (kind !== "input" && kind !== "output") {
    return null;
  }

  return {
    nodeId: terminalId.slice(0, separator),
    kind,
  };
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
