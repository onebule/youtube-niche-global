export type HfVideoAsset = { url: string | null; path: string | null; contentType: string | null; generationId: string | null };
export type HfProviderReport = { queueState: string | null; generationState: string | null; timings: Record<string, unknown>; confidence: 'LOW'; calibrationRequired: true; [key: string]: unknown };

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const isVideo = (value: string, contentType: string | null) => Boolean(contentType?.toLowerCase().startsWith('video/') || /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(value));

function candidates(value: unknown, seen = new Set<unknown>()): Array<{ value: string; contentType: string | null }> {
  if (value === null || value === undefined || seen.has(value)) return [];
  if (typeof value === 'string') return isVideo(value, null) ? [{ value, contentType: null }] : [];
  if (typeof value !== 'object') return [];
  seen.add(value);
  const root = record(value);
  const mime = text(root.contentType) || text(root.content_type) || text(root.mime_type) || text(root.mime);
  const direct = [root.url, root.path, root.video_url, root.videoUrl, root.file, root.video, root.videoAsset];
  const output: Array<{ value: string; contentType: string | null }> = [];
  for (const item of direct) {
    const candidate = text(item);
    if (candidate && isVideo(candidate, mime)) output.push({ value: candidate, contentType: mime });
    else if (item && typeof item === 'object') output.push(...candidates(item, seen));
  }
  for (const [key, item] of Object.entries(root)) {
    if (/report|metadata|prompt|timing|status|state|error/i.test(key)) continue;
    output.push(...candidates(item, seen));
  }
  return output;
}

export function normalizeHfZeroGpuOutput(payload: unknown) {
  const root = record(payload);
  const first = candidates(payload)[0] || null;
  const generationId = text(root.generationId) || text(root.generation_id) || text(root.id) || text(root.task_id);
  const reportRoot = record(root.providerReport || root.provider_report || root.report);
  const providerReport: HfProviderReport = {
    ...reportRoot,
    queueState: text(reportRoot.queueState) || text(root.queueState) || text(root.queue_state),
    generationState: text(reportRoot.generationState) || text(root.state) || text(root.status),
    timings: record(reportRoot.timings || root.timings),
    confidence: 'LOW',
    calibrationRequired: true,
  };
  const videoAsset: HfVideoAsset = {
    url: first?.value?.startsWith('http') ? first.value : null,
    path: first?.value && !first.value.startsWith('http') ? first.value : null,
    contentType: first?.contentType || (first ? 'video/mp4' : null),
    generationId,
  };
  return { videoAsset: first ? videoAsset : null, providerReport, rawMetadata: root };
}

export function sanitizeHfError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || 'Unknown Hugging Face error.');
  return message.replace(/hf_[a-z0-9_-]+/gi, '[REDACTED_TOKEN]').replace(/Bearer\s+[^\s,)]+/gi, 'Bearer [REDACTED_TOKEN]').slice(0, 500);
}
