import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  CirclePlus,
  Copy,
  ExternalLink,
  Link2,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
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
  useNodesInitialized,
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
import {
  entitiesCanFlow,
  entityKey,
  type EntityKey,
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import { getRecipeLayoutTitle } from "../composite-recipes";
import {
  getCompatibleGraphConnections,
  getGraphEdgeId,
  type GraphConnectionCandidate,
  type GraphConnectionNode,
} from "../graph-connections";
import type {
  GraphEdgeRoute,
  GraphEdgePorts,
  GraphNodePosition,
  GraphRelay,
  GraphSide,
  GraphTerminalKind,
  GraphTerminalSides,
  RecipeLayout,
  RecipeLayoutEntry,
} from "../types";
import { IconSprite } from "./IconSprite";
import { RecipeIcon } from "./RecipeIcon";

const graphColumnGap = 310;
const graphBaseX = 96;
const graphBaseY = 88;
const graphRowGap = 170;
const recipeNodeWidth = 168;
const recipeNodeHeight = 78;
const relayNodeSize = 66;
const graphOpenFitPadding = 0.18;
const graphSides = ["top", "right", "bottom", "left"] as const satisfies readonly GraphSide[];
const defaultGraphEdgePorts: GraphEdgePorts = {
  sourceSide: "right",
  targetSide: "left",
};
const defaultGraphTerminalSides: GraphTerminalSides = {
  inputSide: "left",
  outputSide: "right",
};

let nextRelaySequence = 1;

const nodeTypes = {
  recipe: RecipeNode,
  relay: RelayNode,
} satisfies NodeTypes;

const edgeTypes = {
  "item-flow": ItemFlowEdge,
} satisfies EdgeTypes;

interface LayoutGraphDialogProps {
  canRedoGraph: boolean;
  canUndoGraph: boolean;
  data: RecipeExplorerData;
  layout: RecipeLayout;
  variant?: "dialog" | "workspace";
  onClose(): void;
  onEdgeItemsChange(edgeId: string, itemKeys: string[]): void;
  onEdgeItemsReset(edgeId: string): void;
  onEdgePortsChange(edgeId: string, ports: GraphEdgePorts): void;
  onEdgeRouteChange(edgeId: string, route: GraphEdgeRoute): void;
  onEdgeRouteReset(edgeId: string): void;
  onExternalItemsChange(terminalId: string, itemKeys: string[]): void;
  onExportLayout(): string | null;
  onGraphEditStart(): void;
  onGraphRedo(): void;
  onGraphUndo(): void;
  onRelayCreate(relay: GraphRelay, position: GraphNodePosition): void;
  onRelayDelete(relayId: string): void;
  onRelayItemsChange(relayId: string, itemKeys: string[]): void;
  onNodePositionChange(entryId: string, position: GraphNodePosition): void;
  onResetGraphPositions(): void;
  onSelectItem(itemId: string): void;
  onTerminalSideChange(terminalId: string, side: GraphSide): void;
}

export function LayoutGraphDialog({
  canRedoGraph,
  canUndoGraph,
  data,
  layout,
  variant = "dialog",
  onClose,
  onEdgeItemsChange,
  onEdgeItemsReset,
  onEdgePortsChange,
  onEdgeRouteChange,
  onEdgeRouteReset,
  onExternalItemsChange,
  onExportLayout,
  onGraphEditStart,
  onGraphRedo,
  onGraphUndo,
  onRelayCreate,
  onRelayDelete,
  onRelayItemsChange,
  onNodePositionChange,
  onResetGraphPositions,
  onSelectItem,
  onTerminalSideChange,
}: LayoutGraphDialogProps) {
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] =
    useState<PendingGraphConnection | null>(null);
  const [smartLinkPreviewNodeId, setSmartLinkPreviewNodeId] = useState<string | null>(
    null,
  );
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [isExportCopied, setIsExportCopied] = useState(false);
  const graphNodesRef = useRef<GraphFlowNode[]>([]);
  const connectionCandidatesRef = useRef<GraphConnectionCandidate[]>([]);
  const focusEdge = useCallback((edgeId: string, additive = false) => {
    setSelectedEdgeIds((currentEdgeIds) => {
      if (!additive) {
        return [edgeId];
      }

      return currentEdgeIds.includes(edgeId)
        ? currentEdgeIds.filter((currentEdgeId) => currentEdgeId !== edgeId)
        : [...currentEdgeIds, edgeId];
    });
    setSelectedNodeId(null);
    setSelectedTerminalId(null);
    setConnectingFromNodeId(null);
    setPendingConnection(null);
  }, []);
  const focusTerminal = useCallback((terminalId: string) => {
    setSelectedTerminalId(terminalId);
    setSelectedEdgeIds([]);
    setSelectedNodeId(null);
    setConnectingFromNodeId(null);
    setPendingConnection(null);
  }, []);
  const changeEdgeItems = useCallback(
    (edgeId: string, itemKeys: string[]) => {
      onGraphEditStart();
      onEdgeItemsChange(edgeId, itemKeys);
    },
    [onEdgeItemsChange, onGraphEditStart],
  );
  const resetEdgeItems = useCallback(
    (edgeId: string) => {
      onGraphEditStart();
      onEdgeItemsReset(edgeId);
    },
    [onEdgeItemsReset, onGraphEditStart],
  );
  const changeEdgePorts = useCallback(
    (edgeId: string, ports: GraphEdgePorts) => {
      onGraphEditStart();
      onEdgePortsChange(edgeId, ports);
    },
    [onEdgePortsChange, onGraphEditStart],
  );
  const changeEdgeRoute = useCallback(
    (edgeId: string, route: GraphEdgeRoute) => {
      onGraphEditStart();
      onEdgeRouteChange(edgeId, route);
    },
    [onEdgeRouteChange, onGraphEditStart],
  );
  const resetEdgeRoute = useCallback(
    (edgeId: string) => {
      onGraphEditStart();
      onEdgeRouteReset(edgeId);
    },
    [onEdgeRouteReset, onGraphEditStart],
  );
  const changeTerminalSide = useCallback(
    (terminalId: string, side: GraphSide) => {
      onGraphEditStart();
      onTerminalSideChange(terminalId, side);
    },
    [onGraphEditStart, onTerminalSideChange],
  );
  const beginPendingConnection = useCallback(
    (firstNodeId: string, secondNodeId: string) => {
      const candidate = getConnectionCandidateBetween(
        connectionCandidatesRef.current,
        firstNodeId,
        secondNodeId,
      );

      if (!candidate) {
        setConnectingFromNodeId(null);
        setPendingConnection(null);
        return;
      }

      setSelectedEdgeIds([]);
      setSelectedNodeId(null);
      setSelectedTerminalId(null);
      setConnectingFromNodeId(null);
      setPendingConnection(createPendingGraphConnection(candidate, layout.edgeItems));
    },
    [layout.edgeItems],
  );
  const selectConnectableNode = useCallback<GraphNodeSelectHandler>(
    (nodeId, event) => {
      event.stopPropagation();

      if (connectingFromNodeId && connectingFromNodeId !== nodeId) {
        beginPendingConnection(connectingFromNodeId, nodeId);
        return;
      }

      if (event.shiftKey && selectedNodeId && selectedNodeId !== nodeId) {
        beginPendingConnection(selectedNodeId, nodeId);
        return;
      }

      setSelectedNodeId(nodeId);
      setSelectedEdgeIds([]);
      setSelectedTerminalId(null);
      setConnectingFromNodeId(null);
      setPendingConnection(null);
    },
    [beginPendingConnection, connectingFromNodeId, selectedNodeId],
  );
  const createRelayFromTerminal = useCallback(
    (terminal: SelectedGraphTerminal) => {
      const itemKeys = uniqueStringItems(
        terminal.entries.map((entry) => getEntityKey(entry)),
      );

      if (!itemKeys.length) {
        return;
      }

      const relay: GraphRelay = {
        id: createGraphRelayId(layout),
        itemKeys,
      };
      const position = getRelayPositionFromTerminal(
        terminal.nodePosition,
        terminal.nodeKind,
        terminal.side,
      );
      const edgeId =
        terminal.kind === "input"
          ? getGraphEdgeId(relay.id, terminal.nodeId)
          : getGraphEdgeId(terminal.nodeId, relay.id);
      const ports =
        terminal.kind === "input"
          ? {
              sourceSide: getOppositeGraphSide(terminal.side),
              targetSide: terminal.side,
            }
          : {
              sourceSide: terminal.side,
              targetSide: getOppositeGraphSide(terminal.side),
            };
      const forcedItemKeys = layout.externalItems[terminal.id] ?? [];
      const remainingForcedItemKeys = forcedItemKeys.filter(
        (itemKey) => !itemKeys.includes(itemKey),
      );

      onGraphEditStart();
      onRelayCreate(relay, position);
      onEdgePortsChange(edgeId, ports);
      onTerminalSideChange(getGraphTerminalId(relay.id, terminal.kind), terminal.side);

      if (terminal.kind === "output") {
        for (const egressEdge of getRelayEgressEdges(
          relay.id,
          itemKeys,
          graphNodesRef.current,
        )) {
          onEdgeItemsChange(egressEdge.edgeId, []);
        }
      }

      if (remainingForcedItemKeys.length !== forcedItemKeys.length) {
        onExternalItemsChange(terminal.id, remainingForcedItemKeys);
      }

      setSelectedNodeId(relay.id);
      setSelectedTerminalId(null);
      setSelectedEdgeIds([]);
      setConnectingFromNodeId(null);
      setPendingConnection(null);
    },
    [
      layout,
      onEdgeItemsChange,
      onEdgePortsChange,
      onExternalItemsChange,
      onGraphEditStart,
      onRelayCreate,
      onTerminalSideChange,
    ],
  );
  const graph = useMemo(
    () =>
      buildLayoutGraph(
        data,
        layout,
        onSelectItem,
        focusEdge,
        changeEdgeRoute,
        resetEdgeRoute,
        focusTerminal,
        selectConnectableNode,
        selectedTerminalId,
      ),
    [
      data,
      changeEdgeRoute,
      resetEdgeRoute,
      focusEdge,
      focusTerminal,
      layout,
      onSelectItem,
      selectConnectableNode,
      selectedTerminalId,
    ],
  );
  graphNodesRef.current = graph.nodes;
  connectionCandidatesRef.current = graph.connectionCandidates;
  const [nodes, setNodes] = useState<GraphFlowNode[]>(graph.nodes);
  const smartLinkPreview = useMemo(
    () =>
      buildSmartLinkPreview(
        data,
        graph.nodes,
        layout.edgePorts,
        layout.edgeRoutes,
        smartLinkPreviewNodeId,
      ),
    [
      data,
      graph.nodes,
      layout.edgePorts,
      layout.edgeRoutes,
      smartLinkPreviewNodeId,
    ],
  );
  const focusedNodeRelations = useMemo(
    () => buildFocusedNodeRelationMap(graph.edges, selectedNodeId),
    [graph.edges, selectedNodeId],
  );
  const edges = useMemo(
    (): ItemFlowEdgeType[] => [
      ...graph.edges.map((edge): ItemFlowEdgeType => ({
        ...edge,
        data: {
          ...edge.data!,
          focusRelation: getFocusedNodeEdgeRelation(edge, selectedNodeId),
        },
        selected: selectedEdgeIds.includes(edge.id),
      })),
      ...smartLinkPreview.edges,
    ],
    [graph.edges, selectedEdgeIds, selectedNodeId, smartLinkPreview.edges],
  );
  const selectedEdges = edges.filter((edge) => selectedEdgeIds.includes(edge.id));
  const selectedEdge = selectedEdges.length === 1 ? selectedEdges[0] ?? null : null;
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedTerminal = useMemo(
    () => getSelectedTerminal(selectedTerminalId, graph.nodes),
    [graph.nodes, selectedTerminalId],
  );
  const pendingConnectionCandidate = pendingConnection
    ? getConnectionCandidate(
        graph.connectionCandidates,
        pendingConnection.sourceId,
        pendingConnection.targetId,
      )
    : null;
  const graphNodes = useMemo(
    () =>
      nodes.map((node): GraphFlowNode => {
        const endpointSelector = getEndpointSelectorForNode(
          node.id,
          selectedEdge,
          changeEdgePorts,
          selectedTerminal,
          changeTerminalSide,
        );
        const isConnectableTarget = Boolean(
          connectingFromNodeId &&
            connectingFromNodeId !== node.id &&
            getConnectionCandidateBetween(
              graph.connectionCandidates,
              connectingFromNodeId,
              node.id,
            ),
        );
        const nodeState = {
          endpointSelector,
          isConnectableTarget,
          isConnecting: connectingFromNodeId === node.id,
          isSelected: node.id === selectedNodeId,
          focusRelation: focusedNodeRelations.get(node.id) ?? null,
          smartLinkRelation: smartLinkPreview.relationByNodeId.get(node.id) ?? null,
          smartLinkInputItemKeys: [
            ...(smartLinkPreview.inputItemKeysByNodeId.get(node.id) ?? []),
          ],
          smartLinkOutputItemKeys: [
            ...(smartLinkPreview.outputItemKeysByNodeId.get(node.id) ?? []),
          ],
        };

        return applyGraphNodeState(node, nodeState);
      }),
    [
      nodes,
      changeEdgePorts,
      changeTerminalSide,
      connectingFromNodeId,
      focusedNodeRelations,
      graph.connectionCandidates,
      selectedEdge,
      selectedNodeId,
      selectedTerminal,
      smartLinkPreview.inputItemKeysByNodeId,
      smartLinkPreview.relationByNodeId,
      smartLinkPreview.outputItemKeysByNodeId,
    ],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isWorkspace = variant === "workspace";
  const hasSavedGraphState =
    layout.relays.length > 0 ||
    Object.keys(layout.graphPositions).length > 0 ||
    Object.keys(layout.edgePorts).length > 0 ||
    Object.keys(layout.edgeRoutes).length > 0 ||
    Object.keys(layout.edgeItems).length > 0 ||
    Object.keys(layout.externalItems).length > 0 ||
    Object.keys(layout.terminalSides).length > 0;
  const title = getRecipeLayoutTitle(data, layout);

  useEffect(() => {
    setNodes(graph.nodes);
  }, [graph.nodes]);

  useEffect(() => {
    setSelectedEdgeIds((currentEdgeIds) =>
      currentEdgeIds.filter((edgeId) =>
        graph.edges.some((edge) => edge.id === edgeId),
      ),
    );
  }, [graph.edges]);

  useEffect(() => {
    if (selectedNodeId && !graph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
      setConnectingFromNodeId(null);
    }
  }, [graph.nodes, selectedNodeId]);

  useEffect(() => {
    if (selectedTerminalId && !getSelectedTerminal(selectedTerminalId, graph.nodes)) {
      setSelectedTerminalId(null);
    }
  }, [graph.nodes, selectedTerminalId]);

  useEffect(() => {
    if (
      smartLinkPreviewNodeId &&
      (smartLinkPreviewNodeId !== selectedNodeId ||
        !graph.nodes.some((node) => node.id === smartLinkPreviewNodeId))
    ) {
      setSmartLinkPreviewNodeId(null);
    }
  }, [graph.nodes, selectedNodeId, smartLinkPreviewNodeId]);

  useEffect(() => {
    if (
      pendingConnection &&
      !getConnectionCandidate(
        graph.connectionCandidates,
        pendingConnection.sourceId,
        pendingConnection.targetId,
      )
    ) {
      setPendingConnection(null);
    }
  }, [graph.connectionCandidates, pendingConnection]);

  useEffect(() => {
    if (!hasSavedGraphState) {
      setIsResetConfirming(false);
    }
  }, [hasSavedGraphState]);

  useEffect(() => {
    if (isWorkspace) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isWorkspace, onClose]);

  const handleNodesChange = useCallback((changes: NodeChange<GraphFlowNode>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const handleNodeDragStop = useCallback<OnNodeDrag<GraphFlowNode>>(
    (_event, node) => {
      onGraphEditStart();
      onNodePositionChange(node.id, node.position);
    },
    [onGraphEditStart, onNodePositionChange],
  );

  function clearGraphFocus() {
    setSelectedEdgeIds([]);
    setSelectedNodeId(null);
    setSelectedTerminalId(null);
    setConnectingFromNodeId(null);
    setPendingConnection(null);
  }

  function handleNodeClick(
    event: ReactMouseEvent,
    node: GraphFlowNode,
  ) {
    selectConnectableNode(node.id, event);
  }

  function toggleConnectMode(nodeId: string) {
    setSelectedEdgeIds([]);
    setSelectedTerminalId(null);
    setPendingConnection(null);
    setConnectingFromNodeId((currentNodeId) =>
      currentNodeId === nodeId ? null : nodeId,
    );
  }

  function applyNodeToolbarChanges(
    node: GraphFlowNode,
    changes: GraphNodeToolbarChanges,
  ) {
    onGraphEditStart();

    if (node.data.kind === "relay" && changes.relayItemKeys) {
      onRelayItemsChange(node.id, changes.relayItemKeys);
    }

    onExternalItemsChange(
      getGraphTerminalId(node.id, "input"),
      changes.externalInputItemKeys,
    );
    onExternalItemsChange(
      getGraphTerminalId(node.id, "output"),
      changes.externalOutputItemKeys,
    );
  }

  function togglePendingConnectionItem(itemKey: string) {
    setPendingConnection((currentConnection) => {
      if (!currentConnection) {
        return currentConnection;
      }

      const itemKeys = new Set(currentConnection.itemKeys);

      if (itemKeys.has(itemKey)) {
        itemKeys.delete(itemKey);
      } else {
        itemKeys.add(itemKey);
      }

      return {
        ...currentConnection,
        itemKeys: [...itemKeys],
      };
    });
  }

  function confirmPendingConnection() {
    if (!pendingConnection || !pendingConnection.itemKeys.length) {
      return;
    }

    const edgeId = getGraphEdgeId(pendingConnection.sourceId, pendingConnection.targetId);

    onGraphEditStart();
    onEdgeItemsChange(edgeId, pendingConnection.itemKeys);
    setSelectedEdgeIds([edgeId]);
    setPendingConnection(null);
  }

  function smartLinkNode(node: GraphFlowNode) {
    const edgeItems = getSmartLinkEdgeItems(node, graph.nodes);

    if (!edgeItems.length) {
      return;
    }

    onGraphEditStart();
    for (const edge of edgeItems) {
      onEdgeItemsChange(edge.edgeId, edge.itemKeys);
    }
  }

  function createRelayFromSelectedEdges() {
    const relayEdges = selectedEdges.filter((edge) => Boolean(edge.data));
    const itemKeys = uniqueStringItems(
      relayEdges.flatMap((edge) =>
        edge.data?.items.map((item) => getEntityKey(item)) ?? [],
      ),
    );

    if (!relayEdges.length || !itemKeys.length) {
      return;
    }

    const relay: GraphRelay = {
      id: createGraphRelayId(layout),
      itemKeys,
    };
    const replacementEdgeItems = new Map<string, Set<string>>();

    onGraphEditStart();
    onRelayCreate(relay, getRelayPositionFromEdges(relayEdges, graph.nodes));

    for (const edge of relayEdges) {
      const edgeData = edge.data;

      if (!edgeData) {
        continue;
      }

      const edgeItemKeys = edgeData.items.map((item) => getEntityKey(item));
      const sourceRelayEdgeId = getGraphEdgeId(edge.source, relay.id);
      const relayTargetEdgeId = getGraphEdgeId(relay.id, edge.target);

      onEdgeItemsChange(edge.id, []);

      if (edgeData.route) {
        onEdgeRouteReset(edge.id);
      }

      onEdgePortsChange(sourceRelayEdgeId, {
        sourceSide: edgeData.ports.sourceSide,
        targetSide: getOppositeGraphSide(edgeData.ports.sourceSide),
      });
      onEdgePortsChange(relayTargetEdgeId, {
        sourceSide: getOppositeGraphSide(edgeData.ports.targetSide),
        targetSide: edgeData.ports.targetSide,
      });
      addReplacementEdgeItems(replacementEdgeItems, sourceRelayEdgeId, edgeItemKeys);
      addReplacementEdgeItems(replacementEdgeItems, relayTargetEdgeId, edgeItemKeys);
    }

    for (const egressEdge of getRelayEgressEdges(relay.id, itemKeys, graph.nodes)) {
      if (!replacementEdgeItems.has(egressEdge.edgeId)) {
        onEdgeItemsChange(egressEdge.edgeId, []);
      }
    }
    for (const [edgeId, edgeItemKeys] of replacementEdgeItems) {
      onEdgeItemsChange(edgeId, [...edgeItemKeys]);
    }

    setSelectedNodeId(relay.id);
    setSelectedTerminalId(null);
    setSelectedEdgeIds([]);
    setConnectingFromNodeId(null);
    setPendingConnection(null);
  }

  function deleteRelay(relayId: string) {
    onGraphEditStart();
    onRelayDelete(relayId);
    clearGraphFocus();
  }

  function openExportDialog() {
    const value = onExportLayout();

    if (!value) {
      return;
    }

    setExportText(value);
    setIsExportCopied(false);
  }

  function closeExportDialog() {
    setExportText(null);
    setIsExportCopied(false);
  }

  async function copyExportText() {
    if (!exportText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setIsExportCopied(true);
      window.setTimeout(() => setIsExportCopied(false), 1400);
    } catch {
      setIsExportCopied(false);
    }
  }

  return (
    <div
      className={
        isWorkspace
          ? "layout-graph-view"
          : `layout-graph-backdrop ${isFullscreen ? "popup-backdrop--fullscreen" : ""}`
      }
      onMouseDown={(event) => {
        if (!isWorkspace && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="layout-graph-title"
        aria-modal={isWorkspace ? undefined : true}
        className={`layout-graph-dialog app-panel ${
          isWorkspace ? "layout-graph-dialog--workspace" : ""
        } ${!isWorkspace && isFullscreen ? "popup-dialog--fullscreen" : ""}`}
        role={isWorkspace ? undefined : "dialog"}
      >
        <header className="layout-graph-dialog__header">
          <div>
            <h2 id="layout-graph-title">{title}</h2>
            <span>
              {layout.entries.length} {layout.entries.length === 1 ? "recipe" : "recipes"}
            </span>
          </div>
          <GraphHeaderToolbar
            connectingFromNodeId={connectingFromNodeId}
            data={data}
            edge={selectedEdge}
            edges={selectedEdges}
            node={selectedNode}
            nodeHasTerminalOverrides={
              selectedNode ? hasNodeTerminalOverrides(layout, selectedNode.id) : false
            }
            pendingCandidate={pendingConnectionCandidate}
            pendingConnection={pendingConnection}
            terminal={selectedTerminal}
            onCancelPendingConnection={() => setPendingConnection(null)}
            onConfirmPendingConnection={confirmPendingConnection}
            onApplyEdgeItems={changeEdgeItems}
            onCreateRelayFromTerminal={createRelayFromTerminal}
            onCreateRelayFromEdges={createRelayFromSelectedEdges}
            onApplyNodeChanges={applyNodeToolbarChanges}
            onDeleteRelay={deleteRelay}
            onResetEdgeItems={resetEdgeItems}
            onSmartLinkNode={smartLinkNode}
            onSmartLinkPreviewNodeChange={setSmartLinkPreviewNodeId}
            onToggleConnectMode={toggleConnectMode}
            onTogglePendingConnectionItem={togglePendingConnectionItem}
          />
          <div className="popup-header-actions">
            <button
              aria-label="Export layout"
              className="icon-button"
              data-tooltip="Export layout"
              type="button"
              onClick={openExportDialog}
            >
              <ExternalLink size={18} aria-hidden="true" />
            </button>
            <button
              aria-label="Undo layout graph change"
              className="icon-button"
              data-tooltip="Undo graph change"
              disabled={!canUndoGraph}
              type="button"
              onClick={() => {
                setIsResetConfirming(false);
                onGraphUndo();
              }}
            >
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <button
              aria-label="Redo layout graph change"
              className="icon-button"
              data-tooltip="Redo graph change"
              disabled={!canRedoGraph}
              type="button"
              onClick={() => {
                setIsResetConfirming(false);
                onGraphRedo();
              }}
            >
              <Redo2 size={18} aria-hidden="true" />
            </button>
            {isResetConfirming ? (
              <div
                aria-label="Confirm graph reset"
                className="layout-graph-reset-confirm"
                role="group"
              >
                <span className="layout-graph-reset-confirm__label">Reset?</span>
                <button
                  aria-label="Confirm graph reset"
                  className="icon-button layout-graph-reset-confirm__button"
                  data-tooltip="Confirm reset"
                  type="button"
                  onClick={() => {
                    onGraphEditStart();
                    onResetGraphPositions();
                    setIsResetConfirming(false);
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                </button>
                <button
                  aria-label="Cancel graph reset"
                  className="icon-button layout-graph-reset-confirm__button"
                  data-tooltip="Cancel reset"
                  type="button"
                  onClick={() => setIsResetConfirming(false)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                aria-label="Reset layout graph"
                className="icon-button"
                data-tooltip="Reset graph"
                disabled={!hasSavedGraphState}
                type="button"
                onClick={() => setIsResetConfirming(true)}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            )}
            {!isWorkspace ? (
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
            ) : null}
            <button
              aria-label={isWorkspace ? "Close graph view" : "Close layout graph"}
              className="icon-button"
              data-tooltip={isWorkspace ? "Layouts" : "Close"}
              type="button"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {nodes.length ? (
          <div className="layout-graph-flow-shell">
            <ReactFlow<GraphFlowNode, ItemFlowEdgeType>
              colorMode="dark"
              defaultEdgeOptions={{
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "#d7b65f",
                },
              }}
              edges={edges}
              edgeTypes={edgeTypes}
              minZoom={0.25}
              nodes={graphNodes}
              nodeTypes={nodeTypes}
              nodesConnectable={false}
              onEdgeClick={(event, edge) =>
                focusEdge(edge.id, event.shiftKey || event.metaKey)
              }
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onNodesChange={handleNodesChange}
              onPaneClick={clearGraphFocus}
              proOptions={{ hideAttribution: true }}
            >
              <GraphOpenAutoSizer layoutId={layout.id} nodeCount={graphNodes.length} />
              <Background color="#4b4735" gap={34} />
              <Controls showInteractive={false} />
              <GraphShortcutHints />
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
      {exportText ? (
        <div
          className="layout-string-backdrop"
          onClick={closeExportDialog}
        >
          <section
            aria-labelledby="layout-export-title"
            aria-modal="true"
            className="layout-string-dialog app-panel"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="layout-string-dialog__header">
              <h2 id="layout-export-title">Export layout string</h2>
              <button
                aria-label="Close export"
                className="icon-button"
                data-tooltip="Close"
                type="button"
                onClick={closeExportDialog}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <label className="layout-string-dialog__field">
              <span>Layout JSON</span>
              <textarea readOnly spellCheck={false} value={exportText} />
            </label>
            <div className="layout-string-dialog__actions">
              <button
                className="layout-string-dialog__secondary"
                type="button"
                onClick={closeExportDialog}
              >
                Close
              </button>
              <button
                className="primary-action-button"
                type="button"
                onClick={() => void copyExportText()}
              >
                {isExportCopied ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <Copy size={18} aria-hidden="true" />
                )}
                {isExportCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function GraphOpenAutoSizer({
  layoutId,
  nodeCount,
}: {
  layoutId: string;
  nodeCount: number;
}) {
  const reactFlow = useReactFlow<GraphFlowNode, ItemFlowEdgeType>();
  const nodesInitialized = useNodesInitialized();
  const fittedLayoutIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      nodeCount === 0 ||
      !nodesInitialized ||
      fittedLayoutIdRef.current === layoutId
    ) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      fittedLayoutIdRef.current = layoutId;
      void reactFlow.fitView({ padding: graphOpenFitPadding, duration: 0 });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [layoutId, nodeCount, nodesInitialized, reactFlow]);

  return null;
}

function GraphShortcutHints() {
  return (
    <aside
      aria-label="Graph keyboard shortcuts"
      className="layout-graph-shortcuts nodrag nopan"
    >
      <span>
        <kbd>Shift</kbd>
        click node
      </span>
      <span>
        <kbd>Shift</kbd>/<kbd>Cmd</kbd>
        click edge
      </span>
    </aside>
  );
}

interface PendingGraphConnection {
  itemKeys: string[];
  sourceId: string;
  targetId: string;
}

function createPendingGraphConnection(
  candidate: GraphConnectionCandidate,
  edgeItems: Record<string, string[]>,
): PendingGraphConnection {
  const availableItemKeys = new Set<string>(
    candidate.availableItems.map((item) => getEntityKey(item)),
  );
  const savedItemKeys = edgeItems[candidate.id];

  return {
    sourceId: candidate.sourceId,
    targetId: candidate.targetId,
    itemKeys:
      savedItemKeys?.filter((itemKey) => availableItemKeys.has(itemKey)) ??
      [...availableItemKeys],
  };
}

interface GraphHeaderToolbarProps {
  connectingFromNodeId: string | null;
  data: RecipeExplorerData;
  edge: ItemFlowEdgeType | null;
  edges: ItemFlowEdgeType[];
  node: GraphFlowNode | null;
  nodeHasTerminalOverrides: boolean;
  pendingCandidate: GraphConnectionCandidate | null;
  pendingConnection: PendingGraphConnection | null;
  terminal: SelectedGraphTerminal | null;
  onApplyNodeChanges(node: GraphFlowNode, changes: GraphNodeToolbarChanges): void;
  onApplyEdgeItems(edgeId: string, itemKeys: string[]): void;
  onCancelPendingConnection(): void;
  onConfirmPendingConnection(): void;
  onCreateRelayFromTerminal(terminal: SelectedGraphTerminal): void;
  onCreateRelayFromEdges(): void;
  onDeleteRelay(relayId: string): void;
  onResetEdgeItems(edgeId: string): void;
  onSmartLinkNode(node: GraphFlowNode): void;
  onSmartLinkPreviewNodeChange(nodeId: string | null): void;
  onToggleConnectMode(nodeId: string): void;
  onTogglePendingConnectionItem(itemKey: string): void;
}

function GraphHeaderToolbar({
  connectingFromNodeId,
  data,
  edge,
  edges,
  node,
  nodeHasTerminalOverrides,
  pendingCandidate,
  pendingConnection,
  terminal,
  onApplyNodeChanges,
  onApplyEdgeItems,
  onCancelPendingConnection,
  onConfirmPendingConnection,
  onCreateRelayFromTerminal,
  onCreateRelayFromEdges,
  onDeleteRelay,
  onResetEdgeItems,
  onSmartLinkNode,
  onSmartLinkPreviewNodeChange,
  onToggleConnectMode,
  onTogglePendingConnectionItem,
}: GraphHeaderToolbarProps) {
  if (pendingConnection && pendingCandidate) {
    const selectedItemKeys = new Set(pendingConnection.itemKeys);

    return (
      <div
        aria-label={`Create edge from ${pendingCandidate.sourceName} to ${pendingCandidate.targetName}`}
        className="layout-graph-toolbar layout-graph-toolbar--edge"
      >
        <span className="layout-graph-toolbar__title">
          {pendingCandidate.sourceName}
          {" -> "}
          {pendingCandidate.targetName}
        </span>
        <GraphToolbarItemGroup
          data={data}
          entries={pendingCandidate.availableItems}
          label="Flow"
          selectedItemKeys={selectedItemKeys}
          tooltipPrefix="Add flow"
          onToggleItem={onTogglePendingConnectionItem}
        />
        <button
          aria-label="Confirm edge"
          className="icon-button layout-graph-toolbar__button"
          data-tooltip="Confirm edge"
          disabled={!pendingConnection.itemKeys.length}
          type="button"
          onClick={onConfirmPendingConnection}
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Cancel edge"
          className="icon-button layout-graph-toolbar__button"
          data-tooltip="Cancel"
          type="button"
          onClick={onCancelPendingConnection}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (terminal) {
    return (
      <GraphTerminalToolbar
        data={data}
        terminal={terminal}
        onCreateRelayFromTerminal={onCreateRelayFromTerminal}
      />
    );
  }

  if (edges.length > 1) {
    return (
      <GraphEdgeSetToolbar
        data={data}
        edges={edges}
        onCreateRelayFromEdges={onCreateRelayFromEdges}
      />
    );
  }

  if (edge?.data) {
    return (
      <GraphEdgeToolbar
        data={data}
        edge={edge}
        onApplyEdgeItems={onApplyEdgeItems}
        onCreateRelayFromEdges={onCreateRelayFromEdges}
        onResetEdgeItems={onResetEdgeItems}
      />
    );
  }

  if (node) {
    return (
      <GraphNodeToolbar
        data={data}
        isConnecting={connectingFromNodeId === node.id}
        node={node}
        nodeHasTerminalOverrides={nodeHasTerminalOverrides}
        onApplyNodeChanges={onApplyNodeChanges}
        onDeleteRelay={onDeleteRelay}
        onSmartLinkNode={onSmartLinkNode}
        onSmartLinkPreviewNodeChange={onSmartLinkPreviewNodeChange}
        onToggleConnectMode={onToggleConnectMode}
      />
    );
  }

  return <div className="layout-graph-toolbar layout-graph-toolbar--empty" />;
}

interface GraphNodeToolbarChanges {
  externalInputItemKeys: string[];
  externalOutputItemKeys: string[];
  relayItemKeys?: string[];
}

interface GraphNodeToolbarDraft {
  externalInputItemKeys: string[];
  externalOutputItemKeys: string[];
  relayItemKeys: string[];
}

interface GraphNodeToolbarProps {
  data: RecipeExplorerData;
  isConnecting: boolean;
  node: GraphFlowNode;
  nodeHasTerminalOverrides: boolean;
  onApplyNodeChanges(node: GraphFlowNode, changes: GraphNodeToolbarChanges): void;
  onDeleteRelay(relayId: string): void;
  onSmartLinkNode(node: GraphFlowNode): void;
  onSmartLinkPreviewNodeChange(nodeId: string | null): void;
  onToggleConnectMode(nodeId: string): void;
}

function GraphNodeToolbar({
  data,
  isConnecting,
  node,
  nodeHasTerminalOverrides,
  onApplyNodeChanges,
  onDeleteRelay,
  onSmartLinkNode,
  onSmartLinkPreviewNodeChange,
  onToggleConnectMode,
}: GraphNodeToolbarProps) {
  const label = node.data.label;
  const committedRelayItemKeys = useMemo(
    () =>
      node.data.kind === "relay"
        ? node.data.materials.map((material) => getEntityKey(material))
        : [],
    [node],
  );
  const committedInputItemKeys = useMemo(
    () => checkedExternalItemKeys(node.data.externalInputOptions),
    [node.data.externalInputOptions],
  );
  const committedOutputItemKeys = useMemo(
    () => checkedExternalItemKeys(node.data.externalOutputOptions),
    [node.data.externalOutputOptions],
  );
  const draftSignature = [
    node.id,
    committedRelayItemKeys.join("|"),
    committedInputItemKeys.join("|"),
    committedOutputItemKeys.join("|"),
  ].join("::");
  const [draft, setDraft] = useState<GraphNodeToolbarDraft>({
    externalInputItemKeys: committedInputItemKeys,
    externalOutputItemKeys: committedOutputItemKeys,
    relayItemKeys: committedRelayItemKeys,
  });

  useEffect(() => {
    setDraft({
      externalInputItemKeys: committedInputItemKeys,
      externalOutputItemKeys: committedOutputItemKeys,
      relayItemKeys: committedRelayItemKeys,
    });
  }, [
    committedInputItemKeys,
    committedOutputItemKeys,
    committedRelayItemKeys,
    draftSignature,
  ]);

  const relayItemKeySet = new Set(draft.relayItemKeys);
  const inputOptions =
    node.data.kind === "relay"
      ? node.data.externalInputOptions.filter((option) =>
          relayItemKeySet.has(option.itemKey),
        )
      : node.data.externalInputOptions;
  const outputOptions =
    node.data.kind === "relay"
      ? node.data.externalOutputOptions.filter((option) =>
          relayItemKeySet.has(option.itemKey),
        )
      : node.data.externalOutputOptions;
  const externalInputItemKeys = optionalExternalItemKeys(
    inputOptions,
    draft.externalInputItemKeys,
  );
  const externalOutputItemKeys = optionalExternalItemKeys(
    outputOptions,
    draft.externalOutputItemKeys,
  );
  const committedOptionalInputItemKeys = optionalExternalItemKeys(
    node.data.externalInputOptions,
    committedInputItemKeys,
  );
  const committedOptionalOutputItemKeys = optionalExternalItemKeys(
    node.data.externalOutputOptions,
    committedOutputItemKeys,
  );
  const hasRelayDelta =
    node.data.kind === "relay" &&
    !haveSameStringItems(draft.relayItemKeys, committedRelayItemKeys);
  const hasTerminalDelta =
    !haveSameStringItems(externalInputItemKeys, committedOptionalInputItemKeys) ||
    !haveSameStringItems(externalOutputItemKeys, committedOptionalOutputItemKeys);
  const hasNodeDelta = hasRelayDelta || hasTerminalDelta;
  const canResetTerminals =
    nodeHasTerminalOverrides ||
    hasOptionalDraftItems(inputOptions, draft.externalInputItemKeys) ||
    hasOptionalDraftItems(outputOptions, draft.externalOutputItemKeys);

  function toggleDraftExternalItem(
    kind: GraphTerminalKind,
    option: GraphExternalItemOption,
  ) {
    if (option.required) {
      return;
    }

    const field =
      kind === "input" ? "externalInputItemKeys" : "externalOutputItemKeys";

    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: toggleStringItem(currentDraft[field], option.itemKey),
    }));
  }

  function toggleDraftRelayMaterial(itemKey: string) {
    if (node.data.kind !== "relay") {
      return;
    }

    setDraft((currentDraft) => {
      const hasItem = currentDraft.relayItemKeys.includes(itemKey);

      if (hasItem && currentDraft.relayItemKeys.length <= 1) {
        return currentDraft;
      }

      const relayItemKeys = toggleStringItem(currentDraft.relayItemKeys, itemKey);
      const allowedItemKeys = new Set(relayItemKeys);

      return {
        ...currentDraft,
        externalInputItemKeys: currentDraft.externalInputItemKeys.filter((key) =>
          allowedItemKeys.has(key),
        ),
        externalOutputItemKeys: currentDraft.externalOutputItemKeys.filter((key) =>
          allowedItemKeys.has(key),
        ),
        relayItemKeys,
      };
    });
  }

  function resetDraftTerminals() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      externalInputItemKeys: requiredExternalItemKeys(inputOptions),
      externalOutputItemKeys: requiredExternalItemKeys(outputOptions),
    }));
  }

  function applyDraftNodeChanges() {
    if (!hasNodeDelta) {
      return;
    }

    onApplyNodeChanges(node, {
      externalInputItemKeys,
      externalOutputItemKeys,
      ...(node.data.kind === "relay"
        ? { relayItemKeys: draft.relayItemKeys }
        : {}),
    });
  }

  return (
    <div
      aria-label={`Node controls for ${label}`}
      className={`layout-graph-toolbar layout-graph-toolbar--node ${
        isConnecting ? "layout-graph-toolbar--connecting" : ""
      }`}
    >
      <span className="layout-graph-toolbar__title">{label}</span>
      {node.data.kind === "relay" ? (
        <GraphToolbarRelayMaterialGroup
          data={data}
          entries={node.data.materials}
          selectedItemKeys={new Set(draft.relayItemKeys)}
          onToggleMaterial={toggleDraftRelayMaterial}
        />
      ) : null}
      <GraphToolbarExternalGroup
        data={data}
        label="In"
        options={inputOptions}
        selectedItemKeys={new Set(draft.externalInputItemKeys)}
        tooltipPrefix="External input"
        onToggleOption={(option) => toggleDraftExternalItem("input", option)}
      />
      <GraphToolbarExternalGroup
        data={data}
        label="Out"
        options={outputOptions}
        selectedItemKeys={new Set(draft.externalOutputItemKeys)}
        tooltipPrefix="External output"
        onToggleOption={(option) => toggleDraftExternalItem("output", option)}
      />
      <button
        aria-label="Reset node terminals"
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Reset terminals"
        disabled={!canResetTerminals}
        type="button"
        onClick={resetDraftTerminals}
      >
        <RotateCcw size={16} aria-hidden="true" />
      </button>
      {node.data.kind === "relay" ? (
        <button
          aria-label={`Delete ${label}`}
          className="icon-button layout-graph-toolbar__button"
          data-tooltip="Delete relay"
          type="button"
          onClick={() => onDeleteRelay(node.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      ) : null}
      <button
        aria-label={`Smart link ${label}`}
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Smart link"
        type="button"
        onBlur={() => onSmartLinkPreviewNodeChange(null)}
        onClick={() => {
          onSmartLinkPreviewNodeChange(null);
          onSmartLinkNode(node);
        }}
        onFocus={() => onSmartLinkPreviewNodeChange(node.id)}
        onMouseEnter={() => onSmartLinkPreviewNodeChange(node.id)}
        onMouseLeave={() => onSmartLinkPreviewNodeChange(null)}
      >
        <Sparkles size={16} aria-hidden="true" />
      </button>
      <button
        aria-label={isConnecting ? "Cancel connect mode" : `Connect ${label}`}
        aria-pressed={isConnecting}
        className="icon-button layout-graph-toolbar__button"
        data-tooltip={isConnecting ? "Cancel connect" : "Connect"}
        type="button"
        onClick={() => onToggleConnectMode(node.id)}
      >
        <Link2 size={16} aria-hidden="true" />
      </button>
      <button
        aria-label="Apply node changes"
        className="icon-button layout-graph-toolbar__button layout-graph-toolbar__button--apply"
        data-tooltip="Apply node changes"
        disabled={!hasNodeDelta}
        type="button"
        onClick={applyDraftNodeChanges}
      >
        <Check size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

interface GraphTerminalToolbarProps {
  data: RecipeExplorerData;
  terminal: SelectedGraphTerminal;
  onCreateRelayFromTerminal(terminal: SelectedGraphTerminal): void;
}

function GraphTerminalToolbar({
  data,
  onCreateRelayFromTerminal,
  terminal,
}: GraphTerminalToolbarProps) {
  const label = terminal.kind === "input" ? "External input" : "External output";

  return (
    <div
      aria-label={`${label} controls for ${terminal.nodeName}`}
      className="layout-graph-toolbar layout-graph-toolbar--terminal"
    >
      <span className="layout-graph-toolbar__title">
        {label}: {terminal.nodeName}
      </span>
      <GraphToolbarStaticItemGroup
        data={data}
        entries={terminal.entries}
        label="Items"
        tooltipPrefix={label}
      />
      <button
        aria-label={`Create relay from ${label.toLowerCase()}`}
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Create relay"
        type="button"
        onClick={() => onCreateRelayFromTerminal(terminal)}
      >
        <CirclePlus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

interface GraphEdgeSetToolbarProps {
  data: RecipeExplorerData;
  edges: ItemFlowEdgeType[];
  onCreateRelayFromEdges(): void;
}

function GraphEdgeSetToolbar({
  data,
  edges,
  onCreateRelayFromEdges,
}: GraphEdgeSetToolbarProps) {
  const entries = uniqueProducts(
    edges.flatMap((edge) => edge.data?.items ?? []),
  );

  return (
    <div
      aria-label={`Controls for ${edges.length} selected edges`}
      className="layout-graph-toolbar layout-graph-toolbar--edge"
    >
      <span className="layout-graph-toolbar__title">{edges.length} flows</span>
      <GraphToolbarStaticItemGroup
        data={data}
        entries={entries}
        label="Flow"
        tooltipPrefix="Selected flow"
      />
      <button
        aria-label="Route selected edges through relay"
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Route through relay"
        disabled={!entries.length}
        type="button"
        onClick={onCreateRelayFromEdges}
      >
        <CirclePlus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

interface GraphEdgeToolbarProps {
  data: RecipeExplorerData;
  edge: ItemFlowEdgeType;
  onApplyEdgeItems(edgeId: string, itemKeys: string[]): void;
  onCreateRelayFromEdges(): void;
  onResetEdgeItems(edgeId: string): void;
}

interface EdgeMaterialDraft {
  itemKeys: string[];
  resetToDefault: boolean;
}

function GraphEdgeToolbar({
  data,
  edge,
  onApplyEdgeItems,
  onCreateRelayFromEdges,
  onResetEdgeItems,
}: GraphEdgeToolbarProps) {
  const edgeData = edge.data;
  const availableItemKeys = useMemo(
    () => edgeData?.availableItems.map((item) => getEntityKey(item)) ?? [],
    [edgeData],
  );
  const committedItemKeys = useMemo(
    () => edgeData?.items.map((item) => getEntityKey(item)) ?? [],
    [edgeData],
  );
  const availableSignature = availableItemKeys.join("|");
  const committedSignature = committedItemKeys.join("|");
  const [draft, setDraft] = useState<EdgeMaterialDraft>({
    itemKeys: committedItemKeys,
    resetToDefault: false,
  });

  useEffect(() => {
    setDraft({
      itemKeys: committedItemKeys,
      resetToDefault: false,
    });
  }, [edge.id, availableSignature, committedSignature, committedItemKeys]);

  if (!edgeData) {
    return null;
  }

  const selectedItemKeys = new Set(draft.itemKeys);
  const hasMaterialDelta =
    !haveSameStringItems(draft.itemKeys, committedItemKeys) ||
    (draft.resetToDefault && edgeData.hasItemOverride);
  const canResetMaterial =
    edgeData.hasItemOverride || !haveSameStringItems(draft.itemKeys, availableItemKeys);

  function toggleDraftItem(itemKey: string) {
    setDraft((currentDraft) => {
      const nextItemKeys = new Set(currentDraft.itemKeys);

      if (nextItemKeys.has(itemKey)) {
        nextItemKeys.delete(itemKey);
      } else {
        nextItemKeys.add(itemKey);
      }

      return {
        itemKeys: availableItemKeys.filter((availableItemKey) =>
          nextItemKeys.has(availableItemKey),
        ),
        resetToDefault: false,
      };
    });
  }

  function resetDraftMaterial() {
    setDraft({
      itemKeys: availableItemKeys,
      resetToDefault: true,
    });
  }

  function applyDraftMaterial() {
    if (!hasMaterialDelta) {
      return;
    }

    if (
      draft.resetToDefault ||
      haveSameStringItems(draft.itemKeys, availableItemKeys)
    ) {
      onResetEdgeItems(edge.id);
      return;
    }

    onApplyEdgeItems(edge.id, draft.itemKeys);
  }

  return (
    <div
      aria-label={`Edge controls from ${edgeData.sourceName} to ${edgeData.targetName}`}
      className="layout-graph-toolbar layout-graph-toolbar--edge"
    >
      <span className="layout-graph-toolbar__title">
        {edgeData.sourceName}
        {" -> "}
        {edgeData.targetName}
      </span>
      <GraphToolbarItemGroup
        data={data}
        entries={edgeData.availableItems}
        label="Flow"
        selectedItemKeys={selectedItemKeys}
        tooltipPrefix="Stage flow"
        onToggleItem={toggleDraftItem}
      />
      <button
        aria-label="Reset edge material"
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Reset material"
        disabled={!canResetMaterial}
        type="button"
        onClick={resetDraftMaterial}
      >
        <RotateCcw size={16} aria-hidden="true" />
      </button>
      <button
        aria-label="Route edge through relay"
        className="icon-button layout-graph-toolbar__button"
        data-tooltip="Route through relay"
        disabled={!edgeData.items.length}
        type="button"
        onClick={onCreateRelayFromEdges}
      >
        <CirclePlus size={16} aria-hidden="true" />
      </button>
      <button
        aria-label="Apply edge material"
        className="icon-button layout-graph-toolbar__button layout-graph-toolbar__button--apply"
        data-tooltip="Apply material"
        disabled={!hasMaterialDelta}
        type="button"
        onClick={applyDraftMaterial}
      >
        <Check size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

interface GraphToolbarRelayMaterialGroupProps {
  data: RecipeExplorerData;
  entries: ProductPrototype[];
  selectedItemKeys: Set<string>;
  onToggleMaterial(itemKey: string): void;
}

function GraphToolbarRelayMaterialGroup({
  data,
  entries,
  selectedItemKeys,
  onToggleMaterial,
}: GraphToolbarRelayMaterialGroupProps) {
  return (
    <div className="layout-graph-toolbar__group">
      <span className="layout-graph-toolbar__label">Carry</span>
      <div className="layout-graph-toolbar__items">
        {entries.map((entry) => {
          const itemKey = getEntityKey(entry);
          const checked = selectedItemKeys.has(itemKey);
          const disabled = checked && selectedItemKeys.size <= 1;

          return (
            <GraphItemToggle
              checked={checked}
              data={data}
              disabled={disabled}
              entry={entry}
              itemKey={itemKey}
              key={itemKey}
              tooltipPrefix={
                checked ? "Stage relay material" : "Restore relay material"
              }
              onToggle={() => onToggleMaterial(itemKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface GraphToolbarExternalGroupProps {
  data: RecipeExplorerData;
  label: string;
  options: GraphExternalItemOption[];
  selectedItemKeys: Set<string>;
  tooltipPrefix: string;
  onToggleOption(option: GraphExternalItemOption): void;
}

function GraphToolbarExternalGroup({
  data,
  label,
  options,
  selectedItemKeys,
  tooltipPrefix,
  onToggleOption,
}: GraphToolbarExternalGroupProps) {
  return (
    <div className="layout-graph-toolbar__group">
      <span className="layout-graph-toolbar__label">{label}</span>
      <div className="layout-graph-toolbar__items">
        {options.map((option) => (
          <GraphItemToggle
            checked={option.required || selectedItemKeys.has(option.itemKey)}
            data={data}
            disabled={option.required}
            entry={option.entry}
            itemKey={option.itemKey}
            key={option.itemKey}
            tooltipPrefix={option.required ? `${tooltipPrefix} required` : tooltipPrefix}
            onToggle={() => onToggleOption(option)}
          />
        ))}
      </div>
    </div>
  );
}

interface GraphToolbarStaticItemGroupProps {
  data: RecipeExplorerData;
  entries: Array<IngredientPrototype | ProductPrototype>;
  label: string;
  tooltipPrefix: string;
}

function GraphToolbarStaticItemGroup({
  data,
  entries,
  label,
  tooltipPrefix,
}: GraphToolbarStaticItemGroupProps) {
  return (
    <div className="layout-graph-toolbar__group">
      <span className="layout-graph-toolbar__label">{label}</span>
      <div className="layout-graph-toolbar__items">
        {entries.map((entry) => (
          <GraphStaticItemToken
            data={data}
            entry={entry}
            key={`${entry.type}:${entry.name}`}
            tooltipPrefix={tooltipPrefix}
          />
        ))}
      </div>
    </div>
  );
}

interface GraphStaticItemTokenProps {
  data: RecipeExplorerData;
  entry: IngredientPrototype | ProductPrototype;
  tooltipPrefix: string;
}

function GraphStaticItemToken({
  data,
  entry,
  tooltipPrefix,
}: GraphStaticItemTokenProps) {
  const item = data.itemById.get(entry.name);
  const label = item?.name ?? formatId(entry.name);
  const icon = item ? data.iconById.get(getIconIdForItem(item)) : data.iconById.get(entry.name);
  const itemKey = getEntityKey(entry);

  return (
    <span
      aria-label={`${tooltipPrefix}: ${label}`}
      className="layout-graph-toolbar__item-toggle layout-graph-toolbar__item-toggle--static"
      data-tooltip={`${tooltipPrefix}: ${label} (${itemKey})`}
    >
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={22} />
    </span>
  );
}

interface GraphToolbarItemGroupProps {
  data: RecipeExplorerData;
  entries: ProductPrototype[];
  label: string;
  selectedItemKeys: Set<string>;
  tooltipPrefix: string;
  onToggleItem(itemKey: string): void;
}

function GraphToolbarItemGroup({
  data,
  entries,
  label,
  selectedItemKeys,
  tooltipPrefix,
  onToggleItem,
}: GraphToolbarItemGroupProps) {
  return (
    <div className="layout-graph-toolbar__group">
      <span className="layout-graph-toolbar__label">{label}</span>
      <div className="layout-graph-toolbar__items">
        {entries.map((entry) => {
          const itemKey = getEntityKey(entry);

          return (
            <GraphItemToggle
              checked={selectedItemKeys.has(itemKey)}
              data={data}
              entry={entry}
              itemKey={itemKey}
              key={itemKey}
              tooltipPrefix={tooltipPrefix}
              onToggle={() => onToggleItem(itemKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface GraphItemToggleProps {
  checked: boolean;
  data: RecipeExplorerData;
  disabled?: boolean;
  entry: IngredientPrototype | ProductPrototype;
  itemKey: string;
  tooltipPrefix: string;
  onToggle(): void;
}

function GraphItemToggle({
  checked,
  data,
  disabled = false,
  entry,
  itemKey,
  tooltipPrefix,
  onToggle,
}: GraphItemToggleProps) {
  const item = data.itemById.get(entry.name);
  const label = item?.name ?? formatId(entry.name);
  const icon = item ? data.iconById.get(getIconIdForItem(item)) : data.iconById.get(entry.name);

  return (
    <button
      aria-label={`${tooltipPrefix}: ${label}`}
      aria-pressed={checked}
      className="layout-graph-toolbar__item-toggle"
      data-tooltip={`${tooltipPrefix}: ${label} (${itemKey})`}
      disabled={disabled}
      type="button"
      onClick={onToggle}
    >
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={22} />
    </button>
  );
}

type GraphNodeSelectHandler = (nodeId: string, event: ReactMouseEvent) => void;
type GraphRelation = "input" | "output";
type GraphRelationState = GraphRelation | "mixed";

interface SelectableConnectableGraphNodeData extends Record<string, unknown> {
  endpointSelector?: GraphEndpointSelector | null;
  focusRelation: GraphRelationState | null;
  isConnectableTarget: boolean;
  isConnecting: boolean;
  isSelected: boolean;
  label: string;
  onSelectNode: GraphNodeSelectHandler;
  smartLinkRelation: GraphRelationState | null;
  smartLinkInputItemKeys: string[];
  smartLinkOutputItemKeys: string[];
}

interface BaseGraphNodeData extends SelectableConnectableGraphNodeData {
  data: RecipeExplorerData;
  externalInputOptions: GraphExternalItemOption[];
  externalInputs: IngredientPrototype[];
  externalOutputOptions: GraphExternalItemOption[];
  externalOutputs: ProductPrototype[];
  kind: "recipe" | "relay";
  onFocusTerminal(terminalId: string): void;
  onSelectItem(itemId: string): void;
  nodePosition: GraphNodePosition;
  selectedTerminalId: string | null;
  subtitle: string;
  terminalSides: GraphTerminalSides;
}

interface RecipeNodeData extends BaseGraphNodeData {
  kind: "recipe";
  recipe: RecipePrototype;
}

interface RelayNodeData extends BaseGraphNodeData {
  kind: "relay";
  materials: ProductPrototype[];
  relay: GraphRelay;
}

interface GraphEndpointSelector {
  activeSide: GraphSide;
  kind: "source" | "target" | "terminal-input" | "terminal-output";
  label: string;
  onSelectSide(side: GraphSide): void;
}

interface GraphNodeInteractionState {
  endpointSelector: GraphEndpointSelector | null;
  focusRelation: GraphRelationState | null;
  isConnectableTarget: boolean;
  isConnecting: boolean;
  isSelected: boolean;
  smartLinkRelation: GraphRelationState | null;
  smartLinkInputItemKeys: string[];
  smartLinkOutputItemKeys: string[];
}

interface SelectedGraphTerminal {
  entries: Array<IngredientPrototype | ProductPrototype>;
  id: string;
  kind: GraphTerminalKind;
  nodeKind: "recipe" | "relay";
  nodeName: string;
  nodeId: string;
  nodePosition: GraphNodePosition;
  side: GraphSide;
}

type RecipeFlowNode = Node<RecipeNodeData, "recipe">;
type RelayFlowNode = Node<RelayNodeData, "relay">;
type GraphFlowNode = RecipeFlowNode | RelayFlowNode;
type SelectableConnectableGraphNode = Node<
  SelectableConnectableGraphNodeData,
  string
>;

function applyGraphNodeState<TNode extends SelectableConnectableGraphNode>(
  node: TNode,
  state: GraphNodeInteractionState,
): TNode {
  return {
    ...node,
    selected: state.isSelected,
    data: {
      ...node.data,
      nodePosition: node.position,
      ...state,
    },
  } as TNode;
}

function RecipeNode({ data, id }: NodeProps<RecipeFlowNode>) {
  return (
    <article
      className={`layout-graph-node ${getGraphNodeStateClassName(data)}`}
      onClick={(event) => data.onSelectNode(id, event)}
    >
      <GraphNodeHandles />
      <GraphEndpointButtons
        endpointSelector={data.endpointSelector ?? null}
        nodeLabel={data.label}
      />

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalInputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "input")}
        kind="input"
        onFocusTerminal={data.onFocusTerminal}
        previewItemKeys={data.smartLinkInputItemKeys}
        side={data.terminalSides.inputSide}
        terminalId={getGraphTerminalId(id, "input")}
      />

      <div className="layout-graph-node__main">
        <RecipeIcon data={data.data} label={data.label} recipe={data.recipe} size={30} />
        <div>
          <h3>{data.label}</h3>
          <span>{data.subtitle}</span>
        </div>
      </div>

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalOutputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "output")}
        kind="output"
        onFocusTerminal={data.onFocusTerminal}
        previewItemKeys={data.smartLinkOutputItemKeys}
        side={data.terminalSides.outputSide}
        terminalId={getGraphTerminalId(id, "output")}
      />
    </article>
  );
}

function RelayNode({ data, id }: NodeProps<RelayFlowNode>) {
  const visibleMaterials = data.materials.slice(0, 4);
  const hiddenCount = Math.max(0, data.materials.length - visibleMaterials.length);

  return (
    <article
      className={`layout-graph-node layout-graph-node--relay ${getGraphNodeStateClassName(
        data,
      )}`}
      onClick={(event) => data.onSelectNode(id, event)}
    >
      <GraphNodeHandles />
      <GraphEndpointButtons
        endpointSelector={data.endpointSelector ?? null}
        nodeLabel={data.label}
      />

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalInputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "input")}
        kind="input"
        onFocusTerminal={data.onFocusTerminal}
        previewItemKeys={data.smartLinkInputItemKeys}
        side={data.terminalSides.inputSide}
        terminalId={getGraphTerminalId(id, "input")}
      />

      <div
        aria-label={`${data.label}: ${data.subtitle}`}
        className="layout-graph-relay__main"
        data-tooltip={`${data.label}: ${data.subtitle}`}
      >
        <div className="layout-graph-relay__icons">
          {visibleMaterials.map((entry) => (
            <GraphItemToken
              data={data.data}
              entry={entry}
              key={`${entry.type}:${entry.name}`}
              tooltipPrefix="Relay"
            />
          ))}
        </div>
        {hiddenCount ? (
          <span className="layout-graph-relay__count">+{hiddenCount}</span>
        ) : null}
      </div>

      <GraphBoundaryTerminals
        data={data.data}
        entries={data.externalOutputs}
        isFocused={data.selectedTerminalId === getGraphTerminalId(id, "output")}
        kind="output"
        onFocusTerminal={data.onFocusTerminal}
        previewItemKeys={data.smartLinkOutputItemKeys}
        side={data.terminalSides.outputSide}
        terminalId={getGraphTerminalId(id, "output")}
      />
    </article>
  );
}

function getGraphNodeStateClassName(data: BaseGraphNodeData): string {
  const focusRelation = data.focusRelation;
  const smartLinkRelation = data.smartLinkRelation;

  return [
    data.isSelected ? "layout-graph-node--selected" : "",
    data.isConnecting ? "layout-graph-node--connecting" : "",
    data.isConnectableTarget ? "layout-graph-node--connectable" : "",
    focusRelation ? "layout-graph-node--related" : "",
    focusRelation === "input" || focusRelation === "mixed"
      ? "layout-graph-node--related-input"
      : "",
    focusRelation === "output" || focusRelation === "mixed"
      ? "layout-graph-node--related-output"
      : "",
    smartLinkRelation ? "layout-graph-node--smart-preview" : "",
    smartLinkRelation === "input" || smartLinkRelation === "mixed"
      ? "layout-graph-node--smart-preview-input"
      : "",
    smartLinkRelation === "output" || smartLinkRelation === "mixed"
      ? "layout-graph-node--smart-preview-output"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function GraphNodeHandles() {
  return (
    <>
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
    </>
  );
}

interface GraphEndpointButtonsProps {
  endpointSelector?: GraphEndpointSelector | null;
  nodeLabel: string;
}

function GraphEndpointButtons({
  endpointSelector,
  nodeLabel,
}: GraphEndpointButtonsProps) {
  if (!endpointSelector) {
    return null;
  }

  return (
    <div
      className={`layout-graph-endpoints layout-graph-endpoints--${endpointSelector.kind}`}
    >
      {graphSides.map((side) => (
        <button
          aria-label={`Attach ${endpointSelector.label.toLowerCase()} to ${nodeLabel} ${side}`}
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
  );
}

interface ItemFlowEdgeData extends Record<string, unknown> {
  availableItems: ProductPrototype[];
  data: RecipeExplorerData;
  hasItemOverride: boolean;
  focusRelation?: GraphRelation | null;
  isPreview?: boolean;
  items: ProductPrototype[];
  onFocusEdge(edgeId: string, additive?: boolean): void;
  onRouteChange(edgeId: string, route: GraphEdgeRoute): void;
  onRouteReset(edgeId: string): void;
  ports: GraphEdgePorts;
  route: GraphEdgeRoute | null;
  smartLinkPreviewKind?: GraphRelation;
  sourceName: string;
  targetName: string;
}

type ItemFlowEdgeType = Edge<ItemFlowEdgeData, "item-flow">;

function getFocusedNodeEdgeRelation(
  edge: ItemFlowEdgeType,
  nodeId: string | null,
): GraphRelation | null {
  if (!nodeId) {
    return null;
  }

  if (edge.target === nodeId) {
    return "input";
  }

  if (edge.source === nodeId) {
    return "output";
  }

  return null;
}

function buildFocusedNodeRelationMap(
  edges: ItemFlowEdgeType[],
  nodeId: string | null,
): Map<string, GraphRelationState> {
  const relationByNodeId = new Map<string, GraphRelationState>();

  if (!nodeId) {
    return relationByNodeId;
  }

  for (const edge of edges) {
    if (edge.target === nodeId) {
      addGraphRelation(relationByNodeId, edge.source, "input");
    } else if (edge.source === nodeId) {
      addGraphRelation(relationByNodeId, edge.target, "output");
    }
  }

  return relationByNodeId;
}

function addGraphRelation(
  relationByNodeId: Map<string, GraphRelationState>,
  nodeId: string,
  relation: GraphRelation,
) {
  const existingRelation = relationByNodeId.get(nodeId);

  if (!existingRelation || existingRelation === relation) {
    relationByNodeId.set(nodeId, relation);
    return;
  }

  relationByNodeId.set(nodeId, "mixed");
}

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
  nodes: GraphFlowNode[],
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
    entries,
    id: terminalId,
    kind: terminal.kind,
    nodeKind: node.data.kind,
    nodeName: node.data.label,
    nodeId: terminal.nodeId,
    nodePosition: node.position,
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
  const reactFlow = useReactFlow<GraphFlowNode, ItemFlowEdgeType>();
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
  const focusRelation = edgeData?.focusRelation ?? null;
  const focusEdgeClassName = focusRelation
    ? `layout-graph-edge--node-related layout-graph-edge--node-related-${focusRelation}`
    : "";
  const focusLabelClassName = focusRelation
    ? `layout-graph-edge-label--node-related layout-graph-edge-label--node-related-${focusRelation}`
    : "";
  const isPreview = Boolean(edgeData?.isPreview);
  const previewKind = edgeData?.smartLinkPreviewKind ?? "mixed";
  const previewEdgeClassName = isPreview
    ? `layout-graph-edge--smart-preview-${previewKind}`
    : "";
  const previewLabelClassName = isPreview
    ? `layout-graph-edge-label--smart-preview-${previewKind}`
    : "";

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
        activeEdgeData.onFocusEdge(id);
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
    if (!edgeData || edgeData.isPreview) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    draggingPointerIdRef.current = event.pointerId;
    dragMovedRef.current = false;
    lastRouteRef.current = edgeData.route;
    setIsRouteDragging(true);
  }

  return (
    <>
      <BaseEdge
        className={`layout-graph-edge ${
          selected ? "layout-graph-edge--selected" : ""
        } ${focusEdgeClassName} ${
          isPreview ? "layout-graph-edge--smart-preview" : ""
        } ${previewEdgeClassName}`}
        id={id}
        path={path}
        {...(markerEnd ? { markerEnd } : {})}
      />
      {edgeData?.isPreview ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            className={`layout-graph-edge-label layout-graph-edge-label--smart-preview ${previewLabelClassName} nodrag nopan`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
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
          </div>
        </EdgeLabelRenderer>
      ) : edgeData ? (
        <EdgeLabelRenderer>
          <button
            aria-label={`Focus edge from ${edgeData.sourceName} to ${edgeData.targetName}`}
            className={`layout-graph-edge-label nodrag nopan ${
              selected ? "layout-graph-edge-label--selected" : ""
            } ${focusLabelClassName} ${
              isRouteDragging ? "layout-graph-edge-label--dragging" : ""
            }`}
            data-tooltip={selected ? "Drag to bend edge" : "Focus or drag edge"}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              edgeData.onFocusEdge(id, event.shiftKey || event.metaKey);
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
  previewItemKeys: string[];
  side: GraphSide;
  terminalId: string;
}

function GraphBoundaryTerminals({
  data,
  entries,
  isFocused,
  kind,
  onFocusTerminal,
  previewItemKeys,
  side,
  terminalId,
}: GraphBoundaryTerminalsProps) {
  if (!entries.length) {
    return null;
  }

  const hiddenCount = Math.max(0, entries.length - 3);
  const labelKind = kind === "input" ? "External input" : "External output";
  const previewItemKeySet = new Set(previewItemKeys);
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
          className={`layout-graph-boundary__item ${
            previewItemKeySet.has(getEntityKey(entry))
              ? "layout-graph-boundary__item--smart-preview"
              : ""
          }`}
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
          className={`layout-graph-boundary__item layout-graph-boundary__item--overflow ${
            previewItemKeySet.has(getEntityKey(entry))
              ? "layout-graph-boundary__item--smart-preview"
              : ""
          }`}
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

interface GraphNodeModel extends GraphConnectionNode {
  kind: "recipe" | "relay";
  materials: ProductPrototype[];
  recipe?: RecipePrototype;
  relay?: GraphRelay;
  subtitle: string;
  externalInputOptions: GraphExternalItemOption[];
  externalInputs: IngredientPrototype[];
  externalOutputOptions: GraphExternalItemOption[];
  externalOutputs: ProductPrototype[];
  rank: number;
  sortKey: string;
  position: GraphNodePosition;
}

interface GraphExternalItemOption {
  checked: boolean;
  entry: IngredientPrototype | ProductPrototype;
  itemKey: string;
  required: boolean;
}

interface GraphEdgeDraft {
  availableItems: ProductPrototype[];
  hasItemOverride: boolean;
  id: string;
  targetId: string;
  sourceId: string;
  items: ProductPrototype[];
}

interface LayoutGraphModel {
  connectionCandidates: GraphConnectionCandidate[];
  edges: ItemFlowEdgeType[];
  nodes: GraphFlowNode[];
}

function buildLayoutGraph(
  data: RecipeExplorerData,
  layout: RecipeLayout,
  onSelectItem: (itemId: string) => void,
  onFocusEdge: (edgeId: string, additive?: boolean) => void,
  onEdgeRouteChange: (edgeId: string, route: GraphEdgeRoute) => void,
  onEdgeRouteReset: (edgeId: string) => void,
  onFocusTerminal: (terminalId: string) => void,
  onSelectNode: GraphNodeSelectHandler,
  selectedTerminalId: string | null,
): LayoutGraphModel {
  const entries = getGraphEntries(data, layout);
  const graphNodes = getGraphNodes(data, layout, entries);
  const { activeEdges, connectionCandidates } = buildGraphEdgeDrafts(
    graphNodes,
    layout.edgeItems,
  );

  assignNodeRanks(graphNodes, activeEdges);
  positionGraphNodes(graphNodes, layout.graphPositions);
  attachExternalItems(graphNodes, activeEdges, layout.externalItems);

  return {
    connectionCandidates,
    edges: buildFlowEdges(
      data,
      graphNodes,
      activeEdges,
      layout.edgePorts,
      layout.edgeRoutes,
      onFocusEdge,
      onEdgeRouteChange,
      onEdgeRouteReset,
    ),
    nodes: graphNodes.map((node) =>
      buildFlowNode(
        data,
        node,
        layout,
        onFocusTerminal,
        onSelectNode,
        onSelectItem,
        selectedTerminalId,
      ),
    ),
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

function getGraphNodes(
  data: RecipeExplorerData,
  layout: RecipeLayout,
  entries: GraphEntry[],
): GraphNodeModel[] {
  return [
    ...entries.map(({ entry, recipe, sortKey }) => {
      const metadata = getRecipeMetadata(recipe);

      return {
        id: entry.id,
        ingredients: recipe.ingredients ?? [],
        kind: "recipe" as const,
        label: metadata.name,
        materials: [],
        recipe,
        results: recipe.results ?? [],
        subtitle: metadata.id,
        externalInputOptions: [],
        externalInputs: [],
        externalOutputOptions: [],
        externalOutputs: [],
        rank: 0,
        sortKey,
        position: { x: 0, y: 0 },
      };
    }),
    ...layout.relays.flatMap((relay, index) => {
      const materials = uniqueProducts(
        relay.itemKeys.flatMap((itemKey) => productFromEntityKey(itemKey) ?? []),
      );

      if (!materials.length) {
        return [];
      }

      return [
        {
          id: relay.id,
          ingredients: materials.map(productToIngredient),
          kind: "relay" as const,
          label: "Relay",
          materials,
          relay: {
            ...relay,
            itemKeys: materials.map((material) => getEntityKey(material)),
          },
          results: materials,
          subtitle: formatGraphEntityList(data, materials),
          externalInputOptions: [],
          externalInputs: [],
          externalOutputOptions: [],
          externalOutputs: [],
          rank: 0,
          sortKey: `relay:${formatGraphEntityList(data, materials)}:${index}:${relay.id}`,
          position: { x: 0, y: 0 },
        },
      ];
    }),
  ];
}

function buildFlowNode(
  data: RecipeExplorerData,
  node: GraphNodeModel,
  layout: RecipeLayout,
  onFocusTerminal: (terminalId: string) => void,
  onSelectNode: GraphNodeSelectHandler,
  onSelectItem: (itemId: string) => void,
  selectedTerminalId: string | null,
): GraphFlowNode {
  const baseData: BaseGraphNodeData = {
    data,
    externalInputOptions: node.externalInputOptions,
    externalInputs: node.externalInputs,
    externalOutputOptions: node.externalOutputOptions,
    externalOutputs: node.externalOutputs,
    focusRelation: null,
    isConnectableTarget: false,
    isConnecting: false,
    isSelected: false,
    kind: node.kind,
    label: node.label,
    nodePosition: node.position,
    onFocusTerminal,
    onSelectItem,
    onSelectNode,
    selectedTerminalId,
    smartLinkRelation: null,
    smartLinkInputItemKeys: [],
    smartLinkOutputItemKeys: [],
    subtitle: node.subtitle,
    terminalSides: {
      inputSide:
        layout.terminalSides[getGraphTerminalId(node.id, "input")] ??
        defaultGraphTerminalSides.inputSide,
      outputSide:
        layout.terminalSides[getGraphTerminalId(node.id, "output")] ??
        defaultGraphTerminalSides.outputSide,
    },
  };

  if (node.kind === "recipe" && node.recipe) {
    return {
      id: node.id,
      type: "recipe",
      position: node.position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        ...baseData,
        kind: "recipe",
        recipe: node.recipe,
      },
    };
  }

  return {
    id: node.id,
    type: "relay",
    position: node.position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      ...baseData,
      kind: "relay",
      materials: node.materials,
      relay: node.relay ?? { id: node.id, itemKeys: [] },
    },
  };
}

function buildGraphEdgeDrafts(
  nodes: GraphNodeModel[],
  edgeItems: Record<string, string[]>,
): {
  activeEdges: GraphEdgeDraft[];
  connectionCandidates: GraphConnectionCandidate[];
} {
  const activeEdges: GraphEdgeDraft[] = [];
  const connectionCandidates = getCompatibleGraphConnections(nodes);

  for (const candidate of connectionCandidates) {
    const hasItemOverride = Object.prototype.hasOwnProperty.call(
      edgeItems,
      candidate.id,
    );
    const selectedItemKeys = hasItemOverride
      ? new Set(edgeItems[candidate.id])
      : null;
    const items = selectedItemKeys
      ? candidate.availableItems.filter((item) => selectedItemKeys.has(getEntityKey(item)))
      : candidate.availableItems;

    if (items.length) {
      activeEdges.push({
        availableItems: candidate.availableItems,
        hasItemOverride,
        id: candidate.id,
        sourceId: candidate.sourceId,
        targetId: candidate.targetId,
        items,
      });
    }
  }

  return {
    activeEdges: activeEdges.sort((left, right) => left.id.localeCompare(right.id)),
    connectionCandidates,
  };
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

function attachExternalItems(
  nodes: GraphNodeModel[],
  activeEdges: GraphEdgeDraft[],
  externalItems: Record<string, string[]>,
) {
  const incomingItems = new Map<string, ProductPrototype[]>();
  const outgoingItemKeys = new Map<string, Set<EntityKey>>();

  for (const edge of activeEdges) {
    for (const item of edge.items) {
      addSetValue(outgoingItemKeys, edge.sourceId, getEntityKey(item));
      addMapValue(incomingItems, edge.targetId, item);
    }
  }

  for (const node of nodes) {
    const forcedInputItemKeys = new Set(
      externalItems[getGraphTerminalId(node.id, "input")] ?? [],
    );
    const forcedOutputItemKeys = new Set(
      externalItems[getGraphTerminalId(node.id, "output")] ?? [],
    );
    const nodeIncomingItems = incomingItems.get(node.id) ?? [];
    const nodeOutgoingItemKeys = outgoingItemKeys.get(node.id) ?? new Set<string>();

    node.externalInputOptions = uniqueIngredients(node.ingredients).map(
      (entry) => {
        const itemKey = getEntityKey(entry);
        const required = !nodeIncomingItems.some((item) => entitiesCanFlow(item, entry));

        return {
          checked: required || forcedInputItemKeys.has(itemKey),
          entry,
          itemKey,
          required,
        };
      },
    );
    node.externalOutputOptions = uniqueProducts(node.results).map((entry) => {
      const itemKey = getEntityKey(entry);
      const required = !nodeOutgoingItemKeys.has(itemKey);

      return {
        checked: required || forcedOutputItemKeys.has(itemKey),
        entry,
        itemKey,
        required,
      };
    });
    node.externalInputs = node.externalInputOptions
      .filter((option) => option.checked)
      .map((option) => option.entry as IngredientPrototype);
    node.externalOutputs = node.externalOutputOptions
      .filter((option) => option.checked)
      .map((option) => option.entry as ProductPrototype);
  }
}

function buildFlowEdges(
  data: RecipeExplorerData,
  nodes: GraphNodeModel[],
  edgeDrafts: GraphEdgeDraft[],
  edgePorts: Record<string, GraphEdgePorts>,
  edgeRoutes: Record<string, GraphEdgeRoute>,
  onFocusEdge: (edgeId: string, additive?: boolean) => void,
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
  onFocusEdge: (edgeId: string, additive?: boolean) => void,
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
      availableItems: edge.availableItems,
      data,
      hasItemOverride: edge.hasItemOverride,
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

function createGraphRelayId(layout: RecipeLayout): string {
  const nodeIds = new Set([
    ...layout.entries.map((entry) => entry.id),
    ...layout.relays.map((relay) => relay.id),
  ]);

  let relayId = `relay-${Date.now().toString(36)}-${nextRelaySequence++}`;

  while (nodeIds.has(relayId)) {
    relayId = `relay-${Date.now().toString(36)}-${nextRelaySequence++}`;
  }

  return relayId;
}

function getRelayPositionFromTerminal(
  position: GraphNodePosition,
  kind: "recipe" | "relay",
  side: GraphSide,
): GraphNodePosition {
  const dimensions = getGraphNodeDimensions(kind);
  const center = {
    x: position.x + dimensions.width / 2,
    y: position.y + dimensions.height / 2,
  };
  const vector = getGraphSideVector(side);
  const endpointOffset =
    (side === "left" || side === "right" ? dimensions.width : dimensions.height) / 2;
  const distance = endpointOffset + relayNodeSize / 2 + 86;

  return {
    x: Math.round(center.x + vector.x * distance - relayNodeSize / 2),
    y: Math.round(center.y + vector.y * distance - relayNodeSize / 2),
  };
}

function getRelayPositionFromEdges(
  edges: ItemFlowEdgeType[],
  nodes: GraphFlowNode[],
): GraphNodePosition {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const points = edges.flatMap((edge) => {
    if (edge.data?.route) {
      return [edge.data.route];
    }

    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);

    if (!source || !target) {
      return [];
    }

    const sourceCenter = getGraphFlowNodeCenter(source);
    const targetCenter = getGraphFlowNodeCenter(target);

    return [
      {
        x: (sourceCenter.x + targetCenter.x) / 2,
        y: (sourceCenter.y + targetCenter.y) / 2,
      },
    ];
  });
  const center = points.length
    ? {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      }
    : { x: graphBaseX, y: graphBaseY };

  return {
    x: Math.round(center.x - relayNodeSize / 2),
    y: Math.round(center.y - relayNodeSize / 2),
  };
}

function getGraphFlowNodeCenter(node: GraphFlowNode): GraphPoint {
  const dimensions = getGraphFlowNodeDimensions(node);

  return {
    x: node.position.x + dimensions.width / 2,
    y: node.position.y + dimensions.height / 2,
  };
}

function getGraphFlowNodeDimensions(node: GraphFlowNode): {
  width: number;
  height: number;
} {
  return getGraphNodeDimensions(node.type === "relay" ? "relay" : "recipe");
}

function getGraphNodeDimensions(kind: "recipe" | "relay"): {
  width: number;
  height: number;
} {
  return kind === "relay"
    ? { width: relayNodeSize, height: relayNodeSize }
    : { width: recipeNodeWidth, height: recipeNodeHeight };
}

function getGraphSideVector(side: GraphSide): GraphPoint {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "right":
      return { x: 1, y: 0 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
  }
}

function getOppositeGraphSide(side: GraphSide): GraphSide {
  switch (side) {
    case "top":
      return "bottom";
    case "right":
      return "left";
    case "bottom":
      return "top";
    case "left":
      return "right";
  }
}

function getRelayEgressEdges(
  relayId: string,
  itemKeys: string[],
  nodes: GraphFlowNode[],
): Array<{ edgeId: string; itemKeys: string[] }> {
  const relayProducts = uniqueProducts(
    itemKeys.flatMap((itemKey) => productFromEntityKey(itemKey) ?? []),
  );

  if (!relayProducts.length) {
    return [];
  }

  const relayNode: GraphConnectionNode = {
    id: relayId,
    ingredients: relayProducts.map(productToIngredient),
    label: "Relay",
    results: relayProducts,
  };

  return getCompatibleGraphConnections(
    [relayNode],
    nodes.map(getGraphFlowConnectionNode),
  ).map(graphConnectionToEdgeItems);
}

interface SmartLinkPreview {
  edges: ItemFlowEdgeType[];
  inputItemKeysByNodeId: Map<string, Set<string>>;
  outputItemKeysByNodeId: Map<string, Set<string>>;
  relationByNodeId: Map<string, GraphRelationState>;
}

function buildSmartLinkPreview(
  data: RecipeExplorerData,
  nodes: GraphFlowNode[],
  edgePorts: Record<string, GraphEdgePorts>,
  edgeRoutes: Record<string, GraphEdgeRoute>,
  previewNodeId: string | null,
): SmartLinkPreview {
  const previewNode = previewNodeId
    ? nodes.find((node) => node.id === previewNodeId)
    : null;
  const inputItemKeysByNodeId = new Map<string, Set<string>>();
  const outputItemKeysByNodeId = new Map<string, Set<string>>();
  const relationByNodeId = new Map<string, GraphRelationState>();

  if (!previewNode) {
    return {
      edges: [],
      inputItemKeysByNodeId,
      outputItemKeysByNodeId,
      relationByNodeId,
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const connections = getSmartLinkConnectionCandidates(previewNode, nodes);
  const edges = connections.flatMap((connection): ItemFlowEdgeType[] => {
    const sourceNode = nodeById.get(connection.sourceId);
    const targetNode = nodeById.get(connection.targetId);

    if (!sourceNode || !targetNode) {
      return [];
    }

    const itemKeys = connection.availableItems.map((item) => getEntityKey(item));
    const previewRelation: GraphRelation =
      connection.targetId === previewNode.id ? "input" : "output";

    addSetValues(outputItemKeysByNodeId, connection.sourceId, itemKeys);
    addSetValues(inputItemKeysByNodeId, connection.targetId, itemKeys);
    addGraphRelation(relationByNodeId, connection.sourceId, previewRelation);
    addGraphRelation(relationByNodeId, connection.targetId, previewRelation);

    const ports = edgePorts[connection.id] ?? defaultGraphEdgePorts;

    return [
      {
        id: `preview:${connection.id}`,
        type: "item-flow",
        source: connection.sourceId,
        target: connection.targetId,
        sourceHandle: getGraphHandleId("source", ports.sourceSide),
        targetHandle: getGraphHandleId("target", ports.targetSide),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: previewRelation === "input" ? "#b7d58f" : "#f0c96e",
        },
        data: {
          availableItems: connection.availableItems,
          data,
          hasItemOverride: false,
          isPreview: true,
          items: connection.availableItems,
          onFocusEdge: noopFocusEdge,
          onRouteChange: noopRouteChange,
          onRouteReset: noopRouteReset,
          ports,
          route: edgeRoutes[connection.id] ?? null,
          smartLinkPreviewKind: previewRelation,
          sourceName: sourceNode.data.label,
          targetName: targetNode.data.label,
        },
      },
    ];
  });

  return {
    edges,
    inputItemKeysByNodeId,
    outputItemKeysByNodeId,
    relationByNodeId,
  };
}

function getSmartLinkEdgeItems(
  node: GraphFlowNode,
  nodes: GraphFlowNode[],
): Array<{ edgeId: string; itemKeys: string[] }> {
  return uniqueGraphEdgeItems(
    getSmartLinkConnectionCandidates(node, nodes).map(graphConnectionToEdgeItems),
  );
}

function getSmartLinkConnectionCandidates(
  node: GraphFlowNode,
  nodes: GraphFlowNode[],
): GraphConnectionCandidate[] {
  const connectionNode = getGraphFlowConnectionNode(node);
  const graphNodes = nodes.map(getGraphFlowConnectionNode);

  return node.data.kind === "relay"
    ? getCompatibleGraphConnections([connectionNode], graphNodes)
    : [
        ...getCompatibleGraphConnections([connectionNode], graphNodes),
        ...getCompatibleGraphConnections(graphNodes, [connectionNode]),
      ];
}

function graphConnectionToEdgeItems(
  connection: GraphConnectionCandidate,
): { edgeId: string; itemKeys: string[] } {
  return {
    edgeId: connection.id,
    itemKeys: connection.availableItems.map((item) => getEntityKey(item)),
  };
}

function uniqueGraphEdgeItems(
  edgeItems: Array<{ edgeId: string; itemKeys: string[] }>,
): Array<{ edgeId: string; itemKeys: string[] }> {
  const itemKeysByEdgeId = new Map<string, Set<string>>();

  for (const edgeItem of edgeItems) {
    const itemKeys = itemKeysByEdgeId.get(edgeItem.edgeId) ?? new Set<string>();

    for (const itemKey of edgeItem.itemKeys) {
      itemKeys.add(itemKey);
    }

    itemKeysByEdgeId.set(edgeItem.edgeId, itemKeys);
  }

  return [...itemKeysByEdgeId.entries()]
    .map(([edgeId, itemKeys]) => ({ edgeId, itemKeys: [...itemKeys] }))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId));
}

function getGraphFlowConnectionNode(node: GraphFlowNode): GraphConnectionNode {
  return {
    id: node.id,
    ingredients: getGraphFlowNodeIngredients(node),
    label: node.data.label,
    results: getGraphFlowNodeResults(node),
  };
}

function getGraphFlowNodeIngredients(node: GraphFlowNode): IngredientPrototype[] {
  return node.data.kind === "recipe"
    ? (node.data.recipe.ingredients ?? [])
    : node.data.materials.map(productToIngredient);
}

function getGraphFlowNodeResults(node: GraphFlowNode): ProductPrototype[] {
  return node.data.kind === "recipe"
    ? (node.data.recipe.results ?? [])
    : node.data.materials;
}

function addReplacementEdgeItems(
  edgeItems: Map<string, Set<string>>,
  edgeId: string,
  itemKeys: string[],
) {
  const existingItemKeys = edgeItems.get(edgeId) ?? new Set<string>();

  for (const itemKey of itemKeys) {
    existingItemKeys.add(itemKey);
  }

  edgeItems.set(edgeId, existingItemKeys);
}

function productFromEntityKey(itemKey: string): ProductPrototype | null {
  const entity = parseEntityKey(itemKey);

  if (!entity) {
    return null;
  }

  return entity.type === "item"
    ? { type: "item", name: entity.name, amount: 1 }
    : { type: "fluid", name: entity.name, amount: 1 };
}

function productToIngredient(product: ProductPrototype): IngredientPrototype {
  return product.type === "item"
    ? { type: "item", name: product.name, amount: 1 }
    : { type: "fluid", name: product.name, amount: 1 };
}

function parseEntityKey(itemKey: string): { type: "item" | "fluid"; name: string } | null {
  const separator = itemKey.indexOf(":");

  if (separator <= 0 || separator >= itemKey.length - 1) {
    return null;
  }

  const type = itemKey.slice(0, separator);

  if (type !== "item" && type !== "fluid") {
    return null;
  }

  return {
    type,
    name: itemKey.slice(separator + 1),
  };
}

function formatGraphEntityList(
  data: RecipeExplorerData,
  entries: Array<IngredientPrototype | ProductPrototype>,
): string {
  const labels = entries.map((entry) => {
    const item = data.itemById.get(entry.name);

    return item?.name ?? formatId(entry.name);
  });
  const visibleLabels = labels.slice(0, 3);
  const hiddenCount = labels.length - visibleLabels.length;

  return hiddenCount > 0
    ? `${visibleLabels.join(", ")} +${hiddenCount}`
    : visibleLabels.join(", ");
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

function hasNodeTerminalOverrides(layout: RecipeLayout, nodeId: string): boolean {
  return (
    Boolean(layout.externalItems[getGraphTerminalId(nodeId, "input")]?.length) ||
    Boolean(layout.externalItems[getGraphTerminalId(nodeId, "output")]?.length)
  );
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
  return node?.label ?? "Unknown node";
}

function getConnectionCandidate(
  candidates: GraphConnectionCandidate[],
  sourceId: string,
  targetId: string,
): GraphConnectionCandidate | null {
  return (
    candidates.find(
      (candidate) => candidate.sourceId === sourceId && candidate.targetId === targetId,
    ) ?? null
  );
}

function getConnectionCandidateBetween(
  candidates: GraphConnectionCandidate[],
  firstNodeId: string,
  secondNodeId: string,
): GraphConnectionCandidate | null {
  return (
    getConnectionCandidate(candidates, firstNodeId, secondNodeId) ??
    getConnectionCandidate(candidates, secondNodeId, firstNodeId)
  );
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

function haveSameStringItems(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightItems = new Set(right);

  return left.every((item) => rightItems.has(item));
}

function checkedExternalItemKeys(options: GraphExternalItemOption[]): string[] {
  return options.filter((option) => option.checked).map((option) => option.itemKey);
}

function requiredExternalItemKeys(options: GraphExternalItemOption[]): string[] {
  return options.filter((option) => option.required).map((option) => option.itemKey);
}

function optionalExternalItemKeys(
  options: GraphExternalItemOption[],
  selectedItemKeys: string[],
): string[] {
  const selectedItemKeySet = new Set(selectedItemKeys);

  return options
    .filter((option) => !option.required && selectedItemKeySet.has(option.itemKey))
    .map((option) => option.itemKey);
}

function hasOptionalDraftItems(
  options: GraphExternalItemOption[],
  selectedItemKeys: string[],
): boolean {
  return optionalExternalItemKeys(options, selectedItemKeys).length > 0;
}

function toggleStringItem(values: string[], value: string): string[] {
  const nextValues = new Set(values);

  if (nextValues.has(value)) {
    nextValues.delete(value);
  } else {
    nextValues.add(value);
  }

  return [...nextValues].sort();
}

function uniqueStringItems(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function addSetValue<T>(map: Map<string, Set<T>>, key: string, value: T) {
  const values = map.get(key) ?? new Set<T>();

  values.add(value);
  map.set(key, values);
}

function addSetValues<T>(map: Map<string, Set<T>>, key: string, values: T[]) {
  for (const value of values) {
    addSetValue(map, key, value);
  }
}

function getEntityKey(entry: IngredientPrototype | ProductPrototype): EntityKey {
  return entityKey(entry);
}

function addMapValue<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function noopFocusEdge(_edgeId: string, _additive?: boolean) {}

function noopRouteChange(_edgeId: string, _route: GraphEdgeRoute) {}

function noopRouteReset(_edgeId: string) {}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
