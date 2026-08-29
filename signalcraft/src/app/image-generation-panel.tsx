'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import {
  createImageGeneration,
  readImageGenerationHistory,
  refreshImageGeneration,
  type ImageGeneration,
  type ImageGenerationResolution,
  type ImageGenerationSize,
  upsertImageGenerationHistory,
  writeImageGenerationHistory,
} from '@/src/lib/image-generation';
import { VideoGenerationClientError } from '@/src/lib/video-generation';

const SIZE_OPTIONS: Array<{ value: ImageGenerationSize; label: string }> = [
  { value: '1:1', label: '1:1 · 方形' },
  { value: '16:9', label: '16:9 · 横屏' },
  { value: '9:16', label: '9:16 · 竖屏' },
  { value: '4:3', label: '4:3 · 标准' },
  { value: '3:4', label: '3:4 · 竖版' },
];
const RESOLUTION_OPTIONS: Array<{ value: ImageGenerationResolution; label: string }> = [
  { value: '1k', label: '1K · 快速' },
  { value: '2k', label: '2K · 推荐' },
  { value: '4k', label: '4K · 高清' },
];

function clientMessage(cause: unknown, zh: boolean) {
  if (cause instanceof VideoGenerationClientError) return cause.message;
  if (cause instanceof Error && cause.message) return cause.message;
  return zh ? '图片生成服务暂时不可用，请稍后重试。' : 'Image generation is temporarily unavailable. Try again later.';
}

function statusLabel(status: ImageGeneration['status'], zh: boolean) {
  if (status === 'queued') return zh ? '排队中' : 'Queued';
  if (status === 'processing') return zh ? '生成中' : 'Processing';
  if (status === 'completed') return zh ? '已完成' : 'Completed';
  return zh ? '生成失败' : 'Failed';
}

function historyTime(value: string | null, zh: boolean) {
  if (!value) return zh ? '刚刚' : 'Just now';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return zh ? '最近' : 'Recent';
  return time.toLocaleString(zh ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ImageGenerationPanel({
  open,
  zh,
  onClose,
  onUseAsReference,
  notify,
}: {
  open: boolean;
  zh: boolean;
  onClose: () => void;
  onUseAsReference: (assetId: string, imageUrl: string) => void;
  notify: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageGenerationSize>('16:9');
  const [resolution, setResolution] = useState<ImageGenerationResolution>('2k');
  const [task, setTask] = useState<ImageGeneration | null>(null);
  const [history, setHistory] = useState<ImageGeneration[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const completionNotified = useRef<string | null>(null);
  const pollingHandle = useRef<string | null>(null);

  useEffect(() => {
    if (!open || task) return;
    // Defer the state sync one tick: localStorage is an external source and
    // should not trigger a synchronous cascading render from the effect body.
    const timer = window.setTimeout(() => {
      const saved = readImageGenerationHistory();
      setHistory(saved);
      const active = saved.find(item => item.status === 'queued' || item.status === 'processing');
      if (active) {
        pollingHandle.current = active.taskId;
        setTask(active);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, task]);

  useEffect(() => {
    if (!task) return;
    const timer = window.setTimeout(() => {
      setHistory(previous => {
        const next = upsertImageGenerationHistory(previous, task);
        writeImageGenerationHistory(next);
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [task]);

  useEffect(() => {
    if (!open || !task?.taskId || ['completed', 'failed'].includes(task.status)) return;
    let cancelled = false;
    let timeout: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshImageGeneration(pollingHandle.current || task.taskId);
        if (cancelled) return;
        if (next.taskId.startsWith('i1.')) pollingHandle.current = next.taskId;
        setError('');
        setTask(previous => ({ ...previous, ...next, taskId: pollingHandle.current || next.taskId }));
        if (!['completed', 'failed'].includes(next.status)) timeout = window.setTimeout(poll, 2400);
      } catch (cause) {
        if (!cancelled) {
          setError(clientMessage(cause, zh));
          // Expired/invalid handles cannot become valid by polling again.
          // Transient provider/storage failures remain retryable in-place.
          const terminalClientError = cause instanceof VideoGenerationClientError
            && cause.status >= 400 && cause.status < 500 && cause.status !== 429;
          if (!terminalClientError) timeout = window.setTimeout(poll, 4000);
        }
      }
    };
    timeout = window.setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [open, task?.taskId, task?.status, zh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!task || task.status !== 'completed' || !task.imageAssetId || !task.imageUrl) return;
    if (completionNotified.current === task.taskId) return;
    completionNotified.current = task.taskId;
    notify(zh ? 'GPT-Image-2 图片已生成并保存到私有工作区。' : 'GPT-Image-2 image generated and saved to your private workspace.');
  }, [notify, task, zh]);

  if (!open) return null;

  const busy = submitting || task?.status === 'queued' || task?.status === 'processing';
  const restore = async (item: ImageGeneration) => {
    if (busy) return;
    setError('');
    setSubmitting(true);
    pollingHandle.current = item.taskId;
    setTask(item);
    try {
      const next = await refreshImageGeneration(item.taskId);
      if (next.taskId.startsWith('i1.')) pollingHandle.current = next.taskId;
      setTask(previous => ({ ...previous, ...next, taskId: pollingHandle.current || next.taskId }));
    } catch (cause) {
      // A completed provider task may still need one more private-media copy.
      // If that copy failed, show recovery in progress instead of claiming
      // the image is complete while the retry is pending.
      if (item.status === 'completed') {
        setTask({ ...item, status: 'processing', progress: Math.max(1, Math.min(99, item.progress || 99)), errorMessage: null });
      }
      setError(clientMessage(cause, zh));
    } finally {
      setSubmitting(false);
    }
  };
  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setSubmitting(true);
    setError('');
    setTask(null);
    pollingHandle.current = null;
    completionNotified.current = null;
    try {
      const next = await createImageGeneration({ prompt: prompt.trim(), size, resolution });
      if (next.taskId.startsWith('i1.')) pollingHandle.current = next.taskId;
      setTask(next);
    } catch (cause) {
      setError(clientMessage(cause, zh));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="image-generation-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="image-generation-panel" role="dialog" aria-modal="true" aria-labelledby="image-generation-title">
      <header className="image-generation-panel-head">
        <div><span>{zh ? 'AI 创作工具' : 'AI CREATION TOOL'}</span><h2 id="image-generation-title">{zh ? 'AI 生图' : 'AI image generation'}</h2><small>GPT-Image-2 · {zh ? '异步生成' : 'Async generation'}</small></div>
        <button type="button" className="image-generation-close" onClick={onClose} aria-label={zh ? '关闭 AI 生图' : 'Close AI image generation'}>×</button>
      </header>
      <label className="image-generation-field"><span>{zh ? '描述你要生成的画面' : 'Describe the image'}</span><textarea value={prompt} maxLength={2000} rows={5} onChange={event => setPrompt(event.target.value)} placeholder={zh ? '例如：暖色胶片质感的东京街角，雨后反光，人物站在霓虹灯下…' : 'For example: a warm filmic Tokyo street after rain, a person under neon lights…'} /></label>
      <div className="image-generation-options">
        <label className="image-generation-field"><span>{zh ? '画面比例' : 'Aspect ratio'}</span><select value={size} onChange={event => setSize(event.target.value as ImageGenerationSize)}>{SIZE_OPTIONS.map(option => <option value={option.value} key={option.value}>{zh ? option.label : option.value}</option>)}</select></label>
        <label className="image-generation-field"><span>{zh ? '输出分辨率' : 'Resolution'}</span><select value={resolution} onChange={event => setResolution(event.target.value as ImageGenerationResolution)}>{RESOLUTION_OPTIONS.map(option => <option value={option.value} key={option.value}>{zh ? option.label : option.value.toUpperCase()}</option>)}</select></label>
      </div>
      <div className="image-generation-note"><span aria-hidden="true">✦</span><p>{zh ? '生成结果会先转存到私有媒体，再出现在画布中；生成过程中请保持此面板打开。' : 'Results are copied into private media before appearing on the canvas. Keep this panel open while the task is running.'}</p></div>
      <section className="image-generation-history" aria-label={zh ? '最近图片任务' : 'Recent image tasks'}>
        <div className="image-generation-history-head"><div><span>{zh ? '最近任务' : 'RECENT TASKS'}</span><b>{zh ? '已有生成记录' : 'Saved on this browser'}</b></div><small>{zh ? '点击可恢复任务' : 'Click to resume'}</small></div>
        {history.length > 0 ? <div className="image-generation-history-list">
          {history.slice(0, 6).map(item => <button type="button" className={'image-generation-history-item is-' + item.status} key={item.taskId} onClick={() => void restore(item)} disabled={busy}>
            <i aria-hidden="true" />
            <span><strong>{item.prompt || (zh ? '未命名任务' : 'Untitled task')}</strong><small>{historyTime(item.createdAt, zh)} · {statusLabel(item.status, zh)}</small></span>
            <em>{item.status === 'completed' ? '✓' : item.status === 'failed' ? '!' : `${Math.round(item.progress)}%`}</em>
          </button>)}
        </div> : <p className="image-generation-history-empty">{zh ? '当前浏览器还没有可恢复的任务。提交一次后，任务会保留在这里，重新打开即可继续查看。' : 'No resumable tasks on this browser yet. Submit once and the task will stay here for quick resume.'}</p>}
      </section>
      {error && <p className="image-generation-error" role="alert">{error}</p>}
      {task && <section className={'image-generation-result is-' + task.status} aria-live="polite">
        <div className="image-generation-result-head"><div><span>{zh ? '任务状态' : 'TASK STATUS'}</span><b>{statusLabel(task.status, zh)}</b></div><strong>{Math.round(task.progress)}%</strong></div>
        {(task.status === 'queued' || task.status === 'processing') && <div className="image-generation-progress"><i style={{ width: `${Math.max(4, task.progress)}%` }} /></div>}
        {task.status === 'completed' && task.imageUrl && <img className="image-generation-preview" src={task.imageUrl} alt={prompt || (zh ? '生成图片' : 'Generated image')} />}
        {task.status === 'failed' && <p>{task.errorMessage || (zh ? '图片生成失败，请调整描述后重试。' : 'Generation failed. Adjust the prompt and try again.')}</p>}
        {task.status === 'completed' && task.imageAssetId && task.imageUrl && <div className="image-generation-result-actions"><button type="button" className="is-primary" onClick={() => onUseAsReference(task.imageAssetId!, task.imageUrl!)}>{zh ? '加入当前画布参考' : 'Use in current canvas'}</button><a href={task.imageUrl} target="_blank" rel="noreferrer">{zh ? '打开高清图' : 'Open full image'}</a></div>}
      </section>}
      <footer className="image-generation-panel-foot"><button type="button" className="image-generation-cancel" onClick={onClose}>{zh ? '稍后再做' : 'Do later'}</button><button type="button" className="image-generation-submit" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? (zh ? '生成中…' : 'Generating…') : (zh ? '生成图片' : 'Generate image')}<span aria-hidden="true">→</span></button></footer>
    </aside>
  </div>;
}
