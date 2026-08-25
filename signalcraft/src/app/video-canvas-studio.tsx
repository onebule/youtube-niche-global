'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';
import {
  createVideoGeneration,
  loadVideoAssetUrl,
  loadVideoModels,
  refreshVideoGeneration,
  uploadVideoInput,
  VideoGenerationClientError,
  type VideoGeneration,
  type VideoModel,
  type VideoModelId,
} from '@/src/lib/video-generation';

type Point = { x: number; y: number };
type Viewport = Point & { scale: number };
type NodeId = 'source' | 'prompt' | 'model' | 'task' | 'result';
type NodePositions = Record<NodeId, Point>;
type UploadedFrame = { assetId: string; name: string; previewUrl: string; width: number; height: number };
type SavedCanvas = {
  version: 1;
  nodes: NodePositions;
  prompt: string;
  model: VideoModelId;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  shot: number;
  startFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  endFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  generationId: string | null;
};

const STORAGE_KEY = 'signalcraft-video-canvas-v1';
const STAGE_SIZE = { width: 1900, height: 1080 };
const INITIAL_NODES: NodePositions = {
  source: { x: 70, y: 180 },
  prompt: { x: 430, y: 90 },
  model: { x: 450, y: 445 },
  task: { x: 830, y: 240 },
  result: { x: 1190, y: 160 },
};
const NODE_SIZE: Record<NodeId, { width: number; height: number }> = {
  source: { width: 290, height: 470 },
  prompt: { width: 320, height: 280 },
  model: { width: 320, height: 310 },
  task: { width: 280, height: 330 },
  result: { width: 360, height: 500 },
};
const CONNECTIONS: Array<[NodeId, NodeId]> = [
  ['source', 'prompt'],
  ['prompt', 'task'],
  ['model', 'task'],
  ['task', 'result'],
];

const modelName = (model: VideoModelId) => model === 'minimax-h3' ? 'MiniMax H3' : model === 'seedance-2' ? 'Seedance 2.0' : 'Auto';
const statusLabel = (status: VideoGeneration['status'], zh: boolean) => ({
  queued: zh ? '排队中' : 'Queued',
  processing: zh ? '生成中' : 'Processing',
  completed: zh ? '已完成' : 'Completed',
  failed: zh ? '失败' : 'Failed',
}[status]);

function clientMessage(cause: unknown) {
  if (cause instanceof VideoGenerationClientError) return cause.message;
  return cause instanceof Error ? cause.message : '视频生成服务暂时不可用。';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function restoreNodePositions(value: unknown): NodePositions {
  const candidate = value && typeof value === 'object' ? value as Partial<Record<NodeId, Partial<Point>>> : {};
  const next = { ...INITIAL_NODES };
  (Object.keys(INITIAL_NODES) as NodeId[]).forEach(id => {
    const point = candidate[id];
    if (typeof point?.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y)) {
      next[id] = {
        x: clamp(point.x, 0, STAGE_SIZE.width - NODE_SIZE[id].width),
        y: clamp(point.y, 0, STAGE_SIZE.height - NODE_SIZE[id].height),
      };
    }
  });
  return next;
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new VideoGenerationClientError('无法读取图片，请更换 JPG、PNG 或 WEBP 文件。', 422, 'VIDEO_INPUT_INVALID'));
    };
    image.src = url;
  });
}

function assertMiniMaxFrame(frame: UploadedFrame, label: string) {
  const ratio = frame.width / Math.max(1, frame.height);
  if (frame.width < 256 || frame.height < 256 || frame.width > 5760 || frame.height > 5760 || ratio < 0.4 || ratio > 2.5) {
    throw new VideoGenerationClientError(label + ' 图片尺寸不符合 MiniMax H3 要求。边长需为 256–5760px，宽高比需在 0.4–2.5 之间。', 422, 'VIDEO_INPUT_DIMENSION_INVALID');
  }
}

function UploadControl({
  label,
  optional,
  value,
  busy,
  onSelect,
  onRemove,
}: {
  label: string;
  optional?: boolean;
  value: UploadedFrame | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  return <div className="canvas-upload">
    <div className="canvas-upload-head"><b>{label}</b><small>{optional ? 'OPTIONAL' : 'REQUIRED'}</small></div>
    {value ? <div className="canvas-upload-preview">
      {value.previewUrl ? <img src={value.previewUrl} alt={value.name} /> : <div className="canvas-media-loading">读取图片…</div>}
      <span title={value.name}>{value.name}</span>
      <button type="button" onClick={onRemove}>移除</button>
    </div> : <label className="canvas-upload-empty">
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (file) onSelect(file);
        event.currentTarget.value = '';
      }} />
      <span aria-hidden="true">＋</span>
      <b>{busy ? '上传中…' : '选择图片'}</b>
    </label>}
  </div>;
}

export default function VideoCanvasStudio({
  account,
  locale,
  onSignIn,
  notify,
}: {
  account: AccountSession | null;
  locale: UiLocale;
  onSignIn: () => void;
  notify: (message: string) => void;
}) {
  const zh = locale === 'zh';
  const [nodes, setNodes] = useState<NodePositions>(INITIAL_NODES);
  const [viewport, setViewport] = useState<Viewport>({ x: 56, y: 34, scale: 0.82 });
  const [models, setModels] = useState<VideoModel[]>([]);
  const [access, setAccess] = useState<'loading' | 'ready' | 'signed-out' | 'team-only' | 'error'>(account ? 'loading' : 'signed-out');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VideoModelId>('seedance-2');
  const [duration, setDuration] = useState('5s');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [resolution, setResolution] = useState('720p');
  const [shot, setShot] = useState(1);
  const [startFrame, setStartFrame] = useState<UploadedFrame | null>(null);
  const [endFrame, setEndFrame] = useState<UploadedFrame | null>(null);
  const [uploading, setUploading] = useState<'start' | 'end' | null>(null);
  const [generation, setGeneration] = useState<VideoGeneration | null>(null);
  const [restoredGenerationId, setRestoredGenerationId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: NodeId; clientX: number; clientY: number; origin: Point } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; origin: Point } | null>(null);

  const selectedModel = useMemo(() => models.find(item => item.id === model) || null, [models, model]);
  const canGenerate = Boolean(access === 'ready' && startFrame && prompt.trim() && selectedModel?.enabled && !submitting && !uploading);
  const progress = generation?.progress || 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedCanvas;
        if (saved.version === 1) {
          setNodes(restoreNodePositions(saved.nodes));
          setPrompt(saved.prompt || '');
          setModel(saved.model || 'seedance-2');
          setDuration(saved.duration || '5s');
          setAspectRatio(saved.aspectRatio || '9:16');
          setResolution(saved.resolution || '720p');
          setShot(saved.shot || 1);
          if (saved.startFrame) setStartFrame({ ...saved.startFrame, previewUrl: '' });
          if (saved.endFrame) setEndFrame({ ...saved.endFrame, previewUrl: '' });
          setRestoredGenerationId(saved.generationId || null);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const stripUrl = (frame: UploadedFrame | null) => frame ? {
      assetId: frame.assetId,
      name: frame.name,
      width: frame.width,
      height: frame.height,
    } : null;
    const saved: SavedCanvas = {
      version: 1,
      nodes,
      prompt,
      model,
      duration,
      aspectRatio,
      resolution,
      shot,
      startFrame: stripUrl(startFrame),
      endFrame: stripUrl(endFrame),
      generationId: generation?.id || restoredGenerationId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [aspectRatio, duration, endFrame, generation?.id, hydrated, model, nodes, prompt, resolution, restoredGenerationId, shot, startFrame]);

  useEffect(() => {
    if (!account) {
      setAccess('signed-out');
      setModels([]);
      return;
    }
    let cancelled = false;
    setAccess('loading');
    loadVideoModels().then(next => {
      if (cancelled) return;
      setModels(next);
      setAccess('ready');
      const current = next.find(item => item.id === model);
      if (!current?.enabled) {
        const enabled = next.find(item => item.enabled && item.id !== 'auto');
        if (enabled) setModel(enabled.id);
      }
    }).catch(cause => {
      if (cancelled) return;
      const typed = cause as VideoGenerationClientError;
      setAccess(typed.code === 'TEAM_ONLY' ? 'team-only' : 'error');
      setError(clientMessage(cause));
    });
    return () => { cancelled = true; };
  }, [account?.accessToken]);

  useEffect(() => {
    if (access !== 'ready') return;
    let cancelled = false;
    const restore = async () => {
      try {
        if (startFrame && !startFrame.previewUrl) {
          const url = await loadVideoAssetUrl(startFrame.assetId);
          if (!cancelled) setStartFrame(current => current ? { ...current, previewUrl: url } : current);
        }
        if (endFrame && !endFrame.previewUrl) {
          const url = await loadVideoAssetUrl(endFrame.assetId);
          if (!cancelled) setEndFrame(current => current ? { ...current, previewUrl: url } : current);
        }
        if (restoredGenerationId && !generation) {
          const next = await refreshVideoGeneration(restoredGenerationId);
          if (!cancelled) setGeneration(next);
        }
      } catch (cause) {
        if (!cancelled) setError(clientMessage(cause));
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [access, endFrame?.assetId, generation, restoredGenerationId, startFrame?.assetId]);

  useEffect(() => {
    if (!generation || !['queued', 'processing'].includes(generation.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshVideoGeneration(generation.id);
        if (cancelled) return;
        setGeneration(next);
        if (['queued', 'processing'].includes(next.status)) timer = window.setTimeout(() => { void poll(); }, 4500);
      } catch (cause) {
        if (!cancelled) setError(clientMessage(cause));
      }
    };
    timer = window.setTimeout(() => { void poll(); }, 2500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [generation?.id, generation?.status]);

  useEffect(() => {
    if (generation?.status !== 'completed' || !generation.videoAssetId) return;
    let cancelled = false;
    loadVideoAssetUrl(generation.videoAssetId).then(url => {
      if (!cancelled) setVideoUrl(url);
    }).catch(cause => {
      if (!cancelled) setError(clientMessage(cause));
    });
    return () => { cancelled = true; };
  }, [generation?.status, generation?.videoAssetId]);

  useEffect(() => () => {
    if (startFrame?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(startFrame.previewUrl);
  }, [startFrame?.previewUrl]);
  useEffect(() => () => {
    if (endFrame?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(endFrame.previewUrl);
  }, [endFrame?.previewUrl]);

  const upload = async (slot: 'start' | 'end', file: File) => {
    setUploading(slot);
    setError('');
    try {
      const dimensions = await imageDimensions(file);
      const assetId = await uploadVideoInput(file);
      const next = { assetId, name: file.name, previewUrl: URL.createObjectURL(file), ...dimensions };
      if (slot === 'start') setStartFrame(next); else setEndFrame(next);
      notify(zh ? '图片已上传到私有工作区。' : 'Image uploaded to the private workspace.');
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setUploading(null);
    }
  };

  const generate = async () => {
    if (!canGenerate || !startFrame) return;
    setSubmitting(true);
    setError('');
    setVideoUrl('');
    try {
      if (model === 'minimax-h3') {
        assertMiniMaxFrame(startFrame, 'START');
        if (endFrame) assertMiniMaxFrame(endFrame, 'END');
      }
      const next = await createVideoGeneration({
        model,
        prompt: prompt.trim(),
        startImageAssetId: startFrame.assetId,
        endImageAssetId: endFrame?.assetId || null,
        duration,
        aspectRatio,
        resolution,
      });
      setGeneration(next);
      setRestoredGenerationId(next.id);
      notify(zh ? '镜头任务已创建，画布会自动同步进度。' : 'Shot created. The canvas will sync progress automatically.');
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const useAsNextStart = async () => {
    if (!generation?.thumbnailAssetId) return;
    setError('');
    try {
      const url = await loadVideoAssetUrl(generation.thumbnailAssetId);
      setStartFrame({
        assetId: generation.thumbnailAssetId,
        name: (zh ? '镜头 ' : 'Shot ') + String(shot) + (zh ? ' 结果帧' : ' result frame'),
        previewUrl: url,
        width: 1280,
        height: 720,
      });
      setEndFrame(null);
      setPrompt('');
      setGeneration(null);
      setRestoredGenerationId(null);
      setVideoUrl('');
      setShot(value => value + 1);
      notify(zh ? '已创建下一镜头，结果缩略帧已设为 START。' : 'Next shot created from the result thumbnail.');
    } catch (cause) {
      setError(clientMessage(cause));
    }
  };

  const download = async () => {
    if (!generation?.videoAssetId) return;
    try {
      window.location.assign(await loadVideoAssetUrl(generation.videoAssetId, true));
    } catch (cause) {
      setError(clientMessage(cause));
    }
  };

  const startNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, id: NodeId) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, clientX: event.clientX, clientY: event.clientY, origin: nodes[id] };
  };
  const moveNode = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / viewport.scale;
    const dy = (event.clientY - drag.clientY) / viewport.scale;
    setNodes(previous => ({
      ...previous,
      [drag.id]: {
        x: clamp(drag.origin.x + dx, 0, STAGE_SIZE.width - NODE_SIZE[drag.id].width),
        y: clamp(drag.origin.y + dy, 0, STAGE_SIZE.height - NODE_SIZE[drag.id].height),
      },
    }));
  };
  const endNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.video-canvas-node, .video-canvas-toolbar')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { clientX: event.clientX, clientY: event.clientY, origin: { x: viewport.x, y: viewport.y } };
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setViewport(previous => ({
      ...previous,
      x: pan.origin.x + event.clientX - pan.clientX,
      y: pan.origin.y + event.clientY - pan.clientY,
    }));
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
  };
  const zoomAt = (nextScale: number, clientX?: number, clientY?: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    setViewport(previous => {
      const scale = clamp(nextScale, 0.45, 1.35);
      if (!rect || clientX === undefined || clientY === undefined) return { ...previous, scale };
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const worldX = (localX - previous.x) / previous.scale;
      const worldY = (localY - previous.y) / previous.scale;
      return { scale, x: localX - worldX * scale, y: localY - worldY * scale };
    });
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomAt(viewport.scale * (event.deltaY > 0 ? 0.92 : 1.08), event.clientX, event.clientY);
  };

  const edges = useMemo(() => CONNECTIONS.map(([from, to]) => {
    const start = {
      x: nodes[from].x + NODE_SIZE[from].width,
      y: nodes[from].y + NODE_SIZE[from].height / 2,
    };
    const end = {
      x: nodes[to].x,
      y: nodes[to].y + NODE_SIZE[to].height / 2,
    };
    const curve = Math.max(90, Math.abs(end.x - start.x) * 0.45);
    return {
      id: from + '-' + to,
      d: 'M ' + start.x + ' ' + start.y + ' C ' + (start.x + curve) + ' ' + start.y + ', ' + (end.x - curve) + ' ' + end.y + ', ' + end.x + ' ' + end.y,
    };
  }), [nodes]);

  if (access === 'signed-out') return <main className="app-page video-canvas-access"><span>AI CANVAS</span><h1>{zh ? '登录后进入镜头画布。' : 'Sign in to open the shot canvas.'}</h1><p>{zh ? '画布使用现有团队生成服务，不会在浏览器保存第三方密钥。' : 'The canvas uses the existing Team service and never stores provider keys in the browser.'}</p><button type="button" className="primary" onClick={onSignIn}>{zh ? '使用 Google 登录' : 'Sign in with Google'}</button></main>;
  if (access === 'team-only') return <main className="app-page video-canvas-access denied"><span>TEAM ACCESS</span><h1>{zh ? '这个账号还没有 AI 画布权限。' : 'This account does not have AI Canvas access.'}</h1><p>{zh ? '请让站点主人在账号目录中开通 Team 权限。' : 'Ask the owner to grant Team access in the account directory.'}</p></main>;

  return <main className="app-page video-canvas-page">
    <header className="video-canvas-intro">
      <div><span>AI STUDIO · SHOT CANVAS</span><h1>{zh ? '把镜头思路铺开，再交给模型。' : 'Lay out the shot before handing it to the model.'}</h1><p>{zh ? '拖拽节点组织一次图生视频任务；底层仍复用现有 Provider、异步任务、积分和媒体存储。' : 'Arrange one image-to-video task with draggable nodes while reusing the existing providers, task lifecycle, credits, and storage.'}</p></div>
      <aside><b>{zh ? '画布状态' : 'Canvas state'}</b><span>{zh ? '当前设备自动保存' : 'Auto-saved on this device'}</span><button type="button" onClick={() => { setNodes(INITIAL_NODES); setViewport({ x: 56, y: 34, scale: 0.82 }); }}>{zh ? '整理画布' : 'Tidy canvas'}</button></aside>
    </header>

    {error && <div className="video-canvas-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>{zh ? '关闭' : 'Dismiss'}</button></div>}

    <section className="video-canvas-shell" aria-label={zh ? 'AI 图生视频无限画布' : 'AI image-to-video infinite canvas'}>
      <div className="video-canvas-caption">
        <div><span>{String(shot).padStart(2, '0')}</span><b>{zh ? '当前镜头' : 'Current shot'}</b></div>
        <p>{zh ? '拖动空白区域移动画布，滚轮缩放，拖动节点标题重新排布。' : 'Drag the background to pan, use the wheel to zoom, and drag node headers to arrange.'}</p>
      </div>
      <div
        ref={viewportRef}
        className="video-canvas-viewport"
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={wheel}
      >
        <div className="video-canvas-toolbar" aria-label={zh ? '画布缩放' : 'Canvas zoom'}>
          <button type="button" onClick={() => zoomAt(viewport.scale / 1.12)} aria-label={zh ? '缩小' : 'Zoom out'}>−</button>
          <button type="button" onClick={() => zoomAt(1)}>{Math.round(viewport.scale * 100)}%</button>
          <button type="button" onClick={() => zoomAt(viewport.scale * 1.12)} aria-label={zh ? '放大' : 'Zoom in'}>＋</button>
          <button type="button" onClick={() => setViewport({ x: 56, y: 34, scale: 0.82 })}>{zh ? '回到流程' : 'Fit'}</button>
        </div>
        <div className="video-canvas-stage" style={{ width: STAGE_SIZE.width, height: STAGE_SIZE.height, transform: 'translate(' + viewport.x + 'px,' + viewport.y + 'px) scale(' + viewport.scale + ')' }}>
          <svg className="video-canvas-edges" width={STAGE_SIZE.width} height={STAGE_SIZE.height} aria-hidden="true">
            {edges.map(edge => <g key={edge.id}><path className="edge-shadow" d={edge.d} /><path d={edge.d} /></g>)}
          </svg>

          <article className="video-canvas-node source-node" style={{ left: nodes.source.x, top: nodes.source.y, width: NODE_SIZE.source.width, minHeight: NODE_SIZE.source.height }}>
            <div className="canvas-node-grip" onPointerDown={event => startNodeDrag(event, 'source')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>01</span><b>{zh ? '镜头边界' : 'Shot boundary'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body">
              <UploadControl label="START" value={startFrame} busy={uploading === 'start'} onSelect={file => void upload('start', file)} onRemove={() => setStartFrame(null)} />
              <UploadControl label="END" optional value={endFrame} busy={uploading === 'end'} onSelect={file => void upload('end', file)} onRemove={() => setEndFrame(null)} />
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node prompt-node" style={{ left: nodes.prompt.x, top: nodes.prompt.y, width: NODE_SIZE.prompt.width, minHeight: NODE_SIZE.prompt.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" onPointerDown={event => startNodeDrag(event, 'prompt')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>02</span><b>Motion Prompt</b><i>⋮⋮</i></div>
            <div className="canvas-node-body"><textarea value={prompt} maxLength={1200} rows={7} onChange={event => setPrompt(event.target.value)} placeholder={zh ? '主体如何运动？镜头如何移动？光线和节奏如何变化？' : 'How should the subject, camera, light, and pacing move?'} /><small>{prompt.length}/1200</small></div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node model-node" style={{ left: nodes.model.x, top: nodes.model.y, width: NODE_SIZE.model.width, minHeight: NODE_SIZE.model.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" onPointerDown={event => startNodeDrag(event, 'model')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>03</span><b>{zh ? '模型与画幅' : 'Model and format'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-model-fields">
              <label>{zh ? '模型' : 'Model'}<select value={model} onChange={event => {
                const next = event.target.value as VideoModelId;
                setModel(next);
                if (next === 'minimax-h3') setResolution('768P');
                if (next === 'seedance-2' && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p');
              }}><option value="auto" disabled>Auto · {zh ? '即将开放' : 'Coming soon'}</option>{models.filter(item => item.id !== 'auto').map(item => <option key={item.id} value={item.id}>{modelName(item.id)}{item.enabled ? '' : ' · ' + (zh ? '未就绪' : 'Not ready')}</option>)}</select></label>
              <div><label>{zh ? '时长' : 'Duration'}<select value={duration} onChange={event => setDuration(event.target.value)}>{['5s', '8s', '10s'].map(value => <option key={value}>{value}</option>)}</select></label><label>{zh ? '画幅' : 'Ratio'}<select value={aspectRatio} disabled={model === 'minimax-h3'} onChange={event => setAspectRatio(event.target.value as '9:16' | '16:9' | '1:1')}><option>9:16</option><option>16:9</option><option>1:1</option></select></label></div>
              <label>{zh ? '分辨率' : 'Resolution'}<select value={resolution} onChange={event => setResolution(event.target.value)}>{(model === 'minimax-h3' ? ['768P', '2K'] : ['480p', '720p', '1080p']).map(value => <option key={value}>{value}</option>)}</select></label>
              {model === 'minimax-h3' && <small>{zh ? 'H3 沿用 START 图片比例。' : 'H3 follows the START image ratio.'}</small>}
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node task-node" style={{ left: nodes.task.x, top: nodes.task.y, width: NODE_SIZE.task.width, minHeight: NODE_SIZE.task.height }}>
            <span className="node-port input input-a" aria-hidden="true" /><span className="node-port input input-b" aria-hidden="true" />
            <div className="canvas-node-grip" onPointerDown={event => startNodeDrag(event, 'task')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>04</span><b>{zh ? '生成任务' : 'Generation task'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-task-body">
              <div className="canvas-cost"><span>{selectedModel?.ownerUnlimited ? (zh ? '主人积分' : 'Owner credits') : (zh ? '预计消耗' : 'Estimated cost')}</span><b>{selectedModel?.ownerUnlimited ? (zh ? '无限' : 'Unlimited') : selectedModel?.creditsCost ? selectedModel.creditsCost + ' cr' : '—'}</b></div>
              <ul><li className={startFrame ? 'done' : ''}>{zh ? 'START 图片' : 'START frame'}</li><li className={prompt.trim() ? 'done' : ''}>Motion Prompt</li><li className={selectedModel?.enabled ? 'done' : ''}>{zh ? '模型可用' : 'Model ready'}</li></ul>
              <button type="button" className="canvas-generate" disabled={!canGenerate} onClick={() => void generate()}>{submitting ? (zh ? '正在提交…' : 'Submitting…') : (zh ? '生成视频' : 'Generate video')}</button>
              <small>{zh ? '仅成功后扣除积分；失败自动解冻。' : 'Credits settle only on success and release on failure.'}</small>
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node result-node" style={{ left: nodes.result.x, top: nodes.result.y, width: NODE_SIZE.result.width, minHeight: NODE_SIZE.result.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" onPointerDown={event => startNodeDrag(event, 'result')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>05</span><b>{zh ? '视频结果' : 'Video result'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-result-body" aria-live="polite">
              {!generation ? <div className="canvas-result-empty"><span aria-hidden="true">▶</span><b>{zh ? '等待镜头任务' : 'Waiting for a shot'}</b><p>{zh ? '完成左侧节点后，结果和进度会自动出现在这里。' : 'Complete the upstream nodes and the result will appear here.'}</p></div> : <>
                <div className={'canvas-status ' + generation.status}><b>{statusLabel(generation.status, zh)}</b><span>{generation.progress}%</span></div>
                {['queued', 'processing'].includes(generation.status) && <div className="canvas-progress"><i style={{ width: Math.max(4, progress) + '%' }} /></div>}
                {videoUrl ? <video src={videoUrl} controls playsInline preload="metadata" /> : generation.status === 'completed' ? <div className="canvas-media-loading">{zh ? '正在读取私有视频…' : 'Loading private video…'}</div> : null}
                {generation.status === 'failed' && <p className="canvas-failure">{generation.errorMessage || (zh ? '模型未完成本次生成。' : 'The model did not finish this generation.')}</p>}
                <dl><div><dt>{zh ? '模型' : 'Model'}</dt><dd>{modelName(generation.model)}</dd></div><div><dt>{zh ? '规格' : 'Format'}</dt><dd>{generation.duration} · {generation.aspectRatio} · {generation.resolution}</dd></div></dl>
                <div className="canvas-result-actions"><button type="button" disabled={!generation.videoAssetId} onClick={() => void download()}>{zh ? '下载' : 'Download'}</button><button type="button" disabled={!generation.thumbnailAssetId} onClick={() => void useAsNextStart()}>{zh ? '设为下一镜头 START' : 'Use as next START'}</button></div>{generation.thumbnailAssetId && <small>{zh ? '下一镜头将使用结果缩略帧作为 START。' : 'The next shot will use the result thumbnail as START.'}</small>}
                {!generation.thumbnailAssetId && generation.status === 'completed' && <small>{zh ? '模型未返回可复用的结果帧；视频仍可下载。' : 'The model did not return a reusable result frame; the video remains downloadable.'}</small>}
              </>}
            </div>
          </article>
        </div>
      </div>
    </section>
  </main>;
}
