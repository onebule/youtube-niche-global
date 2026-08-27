import type { CanvasNodeId } from './canvas-domain';

export type CanvasPoint = { x: number; y: number };
export type CanvasNodePositions = Record<CanvasNodeId, CanvasPoint>;

export type CanvasCommand =
  | { type: 'move-node'; nodeId: CanvasNodeId; point: CanvasPoint }
  | { type: 'move-nodes'; positions: Partial<Record<CanvasNodeId, CanvasPoint>> }
  | { type: 'reset-layout'; positions: CanvasNodePositions };

function finitePoint(point: CanvasPoint, fallback: CanvasPoint): CanvasPoint {
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : fallback;
}

/**
 * Single command boundary for manual Canvas actions and future Agent tools.
 * Bounds and permissions stay in the owning UI/domain layer; this service
 * only applies immutable position changes to the existing node state.
 */
export function applyCanvasCommand(state: CanvasNodePositions, command: CanvasCommand): CanvasNodePositions {
  if (command.type === 'reset-layout') return { ...command.positions };
  if (command.type === 'move-node') {
    return { ...state, [command.nodeId]: finitePoint(command.point, state[command.nodeId]) };
  }
  const next = { ...state };
  Object.entries(command.positions).forEach(([nodeId, point]) => {
    if (!point || !(nodeId in state)) return;
    next[nodeId as CanvasNodeId] = finitePoint(point, state[nodeId as CanvasNodeId]);
  });
  return next;
}

export const CanvasCommandService = Object.freeze({
  apply: applyCanvasCommand,
  moveNode: (state: CanvasNodePositions, nodeId: CanvasNodeId, point: CanvasPoint) => applyCanvasCommand(state, { type: 'move-node', nodeId, point }),
  moveNodes: (state: CanvasNodePositions, positions: Partial<Record<CanvasNodeId, CanvasPoint>>) => applyCanvasCommand(state, { type: 'move-nodes', positions }),
  resetLayout: (state: CanvasNodePositions, positions: CanvasNodePositions) => applyCanvasCommand(state, { type: 'reset-layout', positions }),
});
