export type AssistantPoint = { x: number; y: number };
export type AssistantBounds = { left: number; top: number; width: number; height: number };
export const ASSISTANT_SIZE = { width: 108, height: 120 };
export const ASSISTANT_DRAG_THRESHOLD = 6;

export function clampAssistantPosition(point: AssistantPoint, bounds: AssistantBounds): AssistantPoint {
  return {
    x: Math.max(bounds.left, Math.min(point.x, bounds.left + Math.max(0, bounds.width - ASSISTANT_SIZE.width))),
    y: Math.max(bounds.top, Math.min(point.y, bounds.top + Math.max(0, bounds.height - ASSISTANT_SIZE.height))),
  };
}

export function assistantDragMoved(start: AssistantPoint, current: AssistantPoint): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= ASSISTANT_DRAG_THRESHOLD;
}

export function assistantPanelPosition(point: AssistantPoint, bounds: AssistantBounds) {
  const width = Math.min(430, bounds.width);
  const height = Math.min(650, bounds.height);
  const above = point.y - height - 12;
  return {
    left: Math.max(bounds.left, Math.min(point.x + ASSISTANT_SIZE.width - width, bounds.left + bounds.width - width)),
    top: Math.max(bounds.top, Math.min(above >= bounds.top ? above : point.y + ASSISTANT_SIZE.height + 12, bounds.top + bounds.height - height)),
    width, height,
  };
}
