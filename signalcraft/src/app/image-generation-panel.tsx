'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import {
  createImageGeneration,
  refreshImageGeneration,
  type ImageGeneration,
  type ImageGenerationResolution,
  type ImageGenerationSize,
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const completionNotified = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !task?.taskId || ['completed', 'failed'].includes(task.status)) return;
    let cancelled = false;
    let timeout: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshImageGeneration(task.taskId);
        if (cancelled) return;
        setError('');
        setTask(previous => ({ ...previous, ...next }));
        if (!['completed', 'failed'].includes(next.status)) timeout = window.setTimeout(poll, 2400);
      } catch (cause) {
        if (!cancelled) {
          setError(clientMessage(cause, zh));
          timeout = window.setTimeout(poll, 4000);
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
  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setSubmitting(true);
    setError('');
    setTask(null);
    completionNotified.current = null;
    try {
      const next = await createImageGeneration({ prompt: prompt.trim(), size, resolution });
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
      {error && <p className="image-generation-error" role="alert">{error}</p>}
      {task && <section className={'image-generation-result is-' + task.status} aria-live="polite">
        <div className="image-generation-result-head"><div><span>{zh ? '任务状态' : 'TASK STATUS'}</span><b>{task.status === 'queued' ? (zh ? '排队中' : 'Queued') : task.status === 'processing' ? (zh ? '生成中' : 'Processing') : task.status === 'completed' ? (zh ? '已完成' : 'Completed') : (zh ? '生成失败' : 'Failed')}</b></div><strong>{Math.round(task.progress)}%</strong></div>
        {(task.status === 'queued' || task.status === 'processing') && <div className="image-generation-progress"><i style={{ width: `${Math.max(4, task.progress)}%` }} /></div>}
        {task.status === 'completed' && task.imageUrl && <img className="image-generation-preview" src={task.imageUrl} alt={prompt || (zh ? '生成图片' : 'Generated image')} />}
        {task.status === 'failed' && <p>{task.errorMessage || (zh ? '图片生成失败，请调整描述后重试。' : 'Generation failed. Adjust the prompt and try again.')}</p>}
        {task.status === 'completed' && task.imageAssetId && task.imageUrl && <div className="image-generation-result-actions"><button type="button" className="is-primary" onClick={() => onUseAsReference(task.imageAssetId!, task.imageUrl!)}>{zh ? '加入当前画布参考' : 'Use in current canvas'}</button><a href={task.imageUrl} target="_blank" rel="noreferrer">{zh ? '打开高清图' : 'Open full image'}</a></div>}
      </section>}
      <footer className="image-generation-panel-foot"><button type="button" className="image-generation-cancel" onClick={onClose}>{zh ? '稍后再做' : 'Do later'}</button><button type="button" className="image-generation-submit" onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? (zh ? '生成中…' : 'Generating…') : (zh ? '生成图片' : 'Generate image')}<span aria-hidden="true">→</span></button></footer>
    </aside>
  </div>;
}
