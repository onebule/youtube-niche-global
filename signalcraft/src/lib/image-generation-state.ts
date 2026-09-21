import type { ImageGeneration } from './image-generation';

type RefreshErrorShape = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

function errorShape(cause: unknown): RefreshErrorShape {
  return cause && typeof cause === 'object' ? cause as RefreshErrorShape : {};
}

/** A 4xx status response (except rate limiting) cannot become valid by polling
 * the same image task handle again. Convert that local view to a terminal state
 * so the panel releases its busy controls and lets the user resubmit safely. */
export function isTerminalImageGenerationRefreshError(cause: unknown) {
  const status = Number(errorShape(cause).status);
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 429;
}

export function failedImageGenerationFromRefresh(
  task: ImageGeneration,
  cause: unknown,
  fallbackMessage: string,
): ImageGeneration {
  const candidate = errorShape(cause);
  const message = typeof candidate.message === 'string' && candidate.message.trim()
    ? candidate.message
    : fallbackMessage;
  const code = typeof candidate.code === 'string' && candidate.code.trim()
    ? candidate.code
    : 'IMAGE_STATUS_UNAVAILABLE';
  return {
    ...task,
    status: 'failed',
    progress: Math.max(0, Math.min(99, Number(task.progress) || 0)),
    completedAt: null,
    errorCode: code,
    errorMessage: message,
  };
}
