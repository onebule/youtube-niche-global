'use client';

import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';
import type { CanvasChatMessage } from './canvas-chat';
export const CANVAS_TEXT_MODEL_OPTIONS = [
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'gpt-6-sol', label: 'GPT-6 Sol' },
  { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
] as const;
export type CanvasTextModelId = typeof CANVAS_TEXT_MODEL_OPTIONS[number]['id'];
export type CanvasTextModel = { id: CanvasTextModelId; label: string; provider: 'claude' | 'gpt'; enabled: boolean; reason: string | null };
const ENDPOINT = (process.env.NEXT_PUBLIC_VIDEO_GATEWAY_URL || 'https://youtube-niche-global-api.vercel.app/api/video').replace(/\/$/, '');
export class CanvasTextClientError extends Error {
  constructor(message: string, public code?: string, public status?: number) { super(message); }
}
async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${ENDPOINT}/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', signal, headers: { ...authHeaders(), accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('文本服务暂时无法响应。 / Text service unavailable.'); }
  if (!response.ok) throw new CanvasTextClientError(clientErrorMessage(payload?.error, '文本生成服务暂不可用。 / Text service unavailable.'), payload?.code, response.status);
  return payload;
}
export async function loadCanvasTextModels(): Promise<CanvasTextModel[]> {
  return (await request<{ models: CanvasTextModel[] }>('canvas-text-models')).models;
}
export async function generateCanvasText(model: CanvasTextModelId, prompt: string) {
  return (await request<{ result: { model: CanvasTextModelId; text: string } }>('canvas-text-generate', { model, prompt, userConfirmed: true })).result;
}

export async function sendCanvasChat(model: CanvasTextModelId, messages: CanvasChatMessage[], signal?: AbortSignal) {
  const response = await fetch(`${ENDPOINT}/canvas-text-chat-long`, { method: 'POST', cache: 'no-store', signal,
    headers: { ...authHeaders(), accept: 'application/x-ndjson', 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, userConfirmed: true }) });
  let result: { model: CanvasTextModelId; text: string } | undefined;
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const payload = await response.json();
    if (!response.ok) throw new CanvasTextClientError('文本调用未完成。', payload?.code, response.status);
    result = payload?.result;
  } else {
    if (!response.body) throw new CanvasTextClientError('文本服务响应不完整。', 'RESPONSE_INVALID');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', bytes = 0;
    const consume = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'error') throw new CanvasTextClientError('文本调用未完成。', event.code, event.status);
      if (event.type === 'result') {
        if (result) throw new CanvasTextClientError('文本服务响应无效。', 'RESPONSE_INVALID');
        result = event.result;
      } else if (event.type !== 'waiting') throw new CanvasTextClientError('文本服务响应无效。', 'RESPONSE_INVALID');
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        bytes += value?.byteLength || 0;
        if (bytes > 160000) throw new CanvasTextClientError('文本服务响应过长。', 'RESPONSE_INVALID');
        buffer += decoder.decode(value, { stream: !done });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
        if (done) { consume(buffer); break; }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  if (result?.model !== model || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 12000) {
    throw new CanvasTextClientError('文本服务未返回可用的回答。', 'RESPONSE_INVALID');
  }
  return result;
}
