'use client';

import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';
export const CANVAS_TEXT_MODEL_OPTIONS = [
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'gpt-6-sol', label: 'GPT-6 Sol' },
  { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
] as const;
export type CanvasTextModelId = typeof CANVAS_TEXT_MODEL_OPTIONS[number]['id'];
export type CanvasTextModel = { id: CanvasTextModelId; label: string; provider: 'claude' | 'gpt'; enabled: boolean; reason: string | null };
const ENDPOINT = (process.env.NEXT_PUBLIC_VIDEO_GATEWAY_URL || 'https://youtube-niche-global-api.vercel.app/api/video').replace(/\/$/, '');
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${ENDPOINT}/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { ...authHeaders(), accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('文本服务暂时无法响应。 / Text service unavailable.'); }
  if (!response.ok) throw new Error(clientErrorMessage(payload?.error, '文本生成服务暂不可用。 / Text service unavailable.'));
  return payload;
}
export async function loadCanvasTextModels(): Promise<CanvasTextModel[]> {
  return (await request<{ models: CanvasTextModel[] }>('canvas-text-models')).models;
}
export async function generateCanvasText(model: CanvasTextModelId, prompt: string) {
  return (await request<{ result: { model: CanvasTextModelId; text: string } }>('canvas-text-generate', { model, prompt, userConfirmed: true })).result;
}
