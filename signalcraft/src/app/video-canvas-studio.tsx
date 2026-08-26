'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';
import {
  createVideoGeneration,
  estimateVideoCredits,
  loadVideoHistory,
  loadVideoAssetUrl,
  loadVideoModels,
  normalizeVideoDuration,
  planVideoGeneration,
  refreshVideoGeneration,
  uploadVideoInput,
  videoDurationOptions,
  VideoGenerationClientError,
  type VideoGeneration,
  type VideoGenerationPlan,
  type VideoModel,
  type VideoModelId,
} from '@/src/lib/video-generation';

type Point = { x: number; y: number };
type Viewport = Point & { scale: number };
type NodeId = 'source' | 'prompt' | 'model' | 'agent' | 'task' | 'result';
type NodePositions = Record<NodeId, Point>;
type UploadedFrame = { assetId: string; name: string; previewUrl: string; width: number; height: number };
type ReferenceMode = 'start-end' | 'omni';
type SavedCanvas = {
  version: 1 | 2 | 3;
  nodes: NodePositions;
  prompt: string;
  model: VideoModelId;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  shot: number;
  startFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  endFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  referenceMode?: ReferenceMode;
  referenceFrames?: Array<Omit<UploadedFrame, 'previewUrl'>>;
  generationId: string | null;
};

const STORAGE_KEY = 'signalcraft-video-canvas-v1';
const STAGE_SIZE = { width: 1900, height: 900 };
const INITIAL_VIEWPORT: Viewport = { x: 46, y: 28, scale: 0.82 };
const INITIAL_NODES: NodePositions = {
  source: { x: 70, y: 110 },
  prompt: { x: 430, y: 90 },
  model: { x: 450, y: 445 },
  agent: { x: 420, y: 135 },
  task: { x: 790, y: 135 },
  result: { x: 1115, y: 90 },
};
const NODE_SIZE: Record<NodeId, { width: number; height: number }> = {
  source: { width: 300, height: 370 },
  prompt: { width: 320, height: 280 },
  model: { width: 320, height: 310 },
  agent: { width: 320, height: 290 },
  task: { width: 275, height: 300 },
  result: { width: 350, height: 410 },
};
const CONNECTIONS: Array<[NodeId, NodeId]> = [
  ['source', 'agent'],
  ['agent', 'task'],
  ['task', 'result'],
];

const modelName = (model: VideoModelId) => model === 'minimax-h3' ? 'MiniMax H3' : model === 'seedance-2-5' ? 'Seedance 2.5' : model === 'seedance-2' ? 'Seedance 2.0' : 'Auto';
const ASPECT_RATIO_OPTIONS: Array<{ value: '9:16' | '16:9' | '1:1'; label: string; className: string }> = [
  { value: '9:16', label: '9:16', className: 'is-portrait' },
  { value: '16:9', label: '16:9', className: 'is-landscape' },
  { value: '1:1', label: '1:1', className: 'is-square' },
];
const statusLabel = (status: VideoGeneration['status'], zh: boolean) => ({
  queued: zh ? '排队中' : 'Queued',
  processing: zh ? '生成中' : 'Processing',
  completed: zh ? '已完成' : 'Completed',
  failed: zh ? '失败' : 'Failed',
}[status]);

function formatHistoryTime(value: string, zh: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return zh ? '时间未知' : 'Unknown time';
  return new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

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
  zh,
  optional,
  value,
  busy,
  onSelect,
  onRemove,
}: {
  label: string;
  zh: boolean;
  optional?: boolean;
  value: UploadedFrame | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  return <div className="canvas-upload">
    <div className="canvas-upload-head"><b>{label}</b><small>{optional ? (zh ? '可选' : 'OPTIONAL') : (zh ? '必需' : 'REQUIRED')}</small></div>
    {value ? <div className="canvas-upload-preview">
      {value.previewUrl ? <img src={value.previewUrl} alt={value.name} /> : <div className="canvas-media-loading">{zh ? '读取图片…' : 'Loading image…'}</div>}
      <span title={value.name}>{value.name}</span>
      <button type="button" onClick={onRemove}>{zh ? '移除' : 'Remove'}</button>
    </div> : <label className="canvas-upload-empty">
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (file) onSelect(file);
        event.currentTarget.value = '';
      }} />
      <span aria-hidden="true">＋</span>
      <b>{busy ? (zh ? '上传中…' : 'Uploading…') : (zh ? '选择图片' : 'Choose image')}</b>
    </label>}
  </div>;
}

function OmniReferenceChip({
  frame,
  mentionLabel,
  loadingLabel,
  removeLabel,
  onMention,
  onRemove,
}: {
  frame: UploadedFrame;
  mentionLabel: string;
  loadingLabel: string;
  removeLabel: string;
  onMention: () => void;
  onRemove: () => void;
}) {
  return <div className="canvas-omni-reference">
    {frame.previewUrl ? <img src={frame.previewUrl} alt={frame.name} /> : <div className="canvas-media-loading">{loadingLabel}</div>}
    <button type="button" className="canvas-reference-mention" onClick={onMention}>{mentionLabel}</button>
    <button type="button" className="canvas-reference-remove" onClick={onRemove} aria-label={removeLabel}>×</button>
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
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [access, setAccess] = useState<'loading' | 'ready' | 'signed-out' | 'team-only' | 'error'>(account ? 'loading' : 'signed-out');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VideoModelId>('seedance-2');
  const [duration, setDuration] = useState('5s');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [resolution, setResolution] = useState('720p');
  const [shot, setShot] = useState(1);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('start-end');
  const [startFrame, setStartFrame] = useState<UploadedFrame | null>(null);
  const [endFrame, setEndFrame] = useState<UploadedFrame | null>(null);
  const [referenceFrames, setReferenceFrames] = useState<UploadedFrame[]>([]);
  const [uploading, setUploading] = useState<'start' | 'end' | 'reference' | null>(null);
  const [generation, setGeneration] = useState<VideoGeneration | null>(null);
  const [agentPlan, setAgentPlan] = useState<VideoGenerationPlan | null>(null);
  const [restoredGenerationId, setRestoredGenerationId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<VideoGeneration[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [nodePaletteOpen, setNodePaletteOpen] = useState(false);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const paletteImageInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ id: NodeId; clientX: number; clientY: number; origin: Point } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; origin: Point } | null>(null);
  const referenceFramesRef = useRef<UploadedFrame[]>([]);
  const fullscreenFallbackRef = useRef(false);

  const selectedModel = useMemo(() => models.find(item => item.id === model) || null, [models, model]);
  const estimatedCredits = useMemo(() => estimateVideoCredits(selectedModel, duration), [duration, selectedModel]);
  const nodeSize = useMemo<Record<NodeId, { width: number; height: number }>>(() => ({
    ...NODE_SIZE,
    source: {
      ...NODE_SIZE.source,
      height: referenceMode === 'omni' ? 250 : NODE_SIZE.source.height,
    },
  }), [referenceMode]);
  // Keep auth transitions derived during render so signing out cannot leave a
  // briefly actionable composer while the account-loading effect settles.
  const hasAccount = Boolean(account);
  const effectiveAccess = account ? access : 'signed-out';
  const hasReferenceInput = referenceMode === 'omni' ? referenceFrames.length > 0 : Boolean(startFrame);
  const referenceModeSupported = referenceMode !== 'omni' || ['minimax-h3', 'seedance-2', 'seedance-2-5'].includes(model);
  const canGenerate = Boolean(effectiveAccess === 'ready' && hasReferenceInput && referenceModeSupported && prompt.trim() && selectedModel?.enabled && !submitting && !uploading);
  const agentPlanBlockedReason = !prompt.trim()
    ? (zh ? '先在下方填写 Motion Prompt' : 'Add a Motion Prompt below first')
    : '';
  const generationBlockedReason = (() => {
    if (submitting) return zh ? '正在提交任务' : 'Submitting the task';
    if (uploading) return zh ? '参考图正在上传' : 'A reference image is uploading';
    if (!hasReferenceInput) return zh ? '先加入至少 1 张参考图' : 'Add at least one reference image';
    if (!prompt.trim()) return zh ? '填写 Motion Prompt 后即可生成' : 'Add a Motion Prompt to generate';
    if (!referenceModeSupported) return zh ? '当前模型不支持这个参考模式' : 'This model does not support the selected reference mode';
    if (!selectedModel?.enabled) return zh ? '选择一个已就绪的模型' : 'Choose a model that is ready';
    return '';
  })();
  const progress = generation?.progress || 0;
  const generationId = generation?.id;
  const generationStatus = generation?.status;

  const rememberGeneration = useCallback((next: VideoGeneration) => {
    setHistory(previous => {
      const merged = [next, ...previous.filter(item => item.id !== next.id)];
      return merged.toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    });
  }, []);

  const loadHistoryPage = async (append = false) => {
    if (effectiveAccess !== 'ready' || (append ? historyLoadingMore : historyLoading)) return;
    if (append) setHistoryLoadingMore(true); else setHistoryLoading(true);
    setHistoryError('');
    try {
      const next = await loadVideoHistory(20, append ? history.length : 0);
      setHistory(previous => append
        ? [...previous, ...next.filter(item => !previous.some(existing => existing.id === item.id))]
        : next,
      );
      setHistoryHasMore(next.length === 20);
    } catch (cause) {
      setHistoryError(clientMessage(cause));
    } finally {
      if (append) setHistoryLoadingMore(false); else setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) setNodePaletteOpen(false);
    if (next && history.length === 0 && !historyLoading) void loadHistoryPage();
  };

  const restoreHistoryItem = (item: VideoGeneration) => {
    setGeneration(item);
    setRestoredGenerationId(item.id);
    setPrompt(item.prompt);
    setModel(item.model);
    setDuration(normalizeVideoDuration(item.model, item.duration));
    setAspectRatio(item.aspectRatio);
    setResolution(item.resolution);
    setVideoUrl('');
    setHistoryOpen(false);
    notify(zh ? '已将历史任务载入当前画布。' : 'History task loaded into the current canvas.');
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsCanvasFullscreen(Boolean(fullscreenFallbackRef.current || document.fullscreenElement === canvasShellRef.current));
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !fullscreenFallbackRef.current) return;
      fullscreenFallbackRef.current = false;
      setIsCanvasFullscreen(false);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isCanvasFullscreen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [isCanvasFullscreen]);

  useEffect(() => {
    if (!historyOpen && !nodePaletteOpen) return;
    const closePanels = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setHistoryOpen(false);
      setNodePaletteOpen(false);
    };
    window.addEventListener('keydown', closePanels);
    return () => window.removeEventListener('keydown', closePanels);
  }, [historyOpen, nodePaletteOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedCanvas;
        if (saved.version === 1 || saved.version === 2 || saved.version === 3) {
          // Hydration intentionally mirrors an external localStorage snapshot
          // after mount; this is the one synchronous state sync in this effect.
          // v3 reserves a dedicated composer row, so older layouts need the
          // new compact positions once instead of restoring covered nodes.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setNodes(saved.version === 3 ? restoreNodePositions(saved.nodes) : INITIAL_NODES);
          setPrompt(saved.prompt || '');
          const restoredReferenceMode = saved.referenceMode || 'start-end';
          const restoredModel = saved.model || 'seedance-2';
          setModel(restoredModel);
          setDuration(normalizeVideoDuration(restoredModel, saved.duration || '5s'));
          setAspectRatio(saved.aspectRatio || '9:16');
          setResolution(saved.resolution || '720p');
          setShot(saved.shot || 1);
          if (saved.startFrame) setStartFrame({ ...saved.startFrame, previewUrl: '' });
          if (saved.endFrame) setEndFrame({ ...saved.endFrame, previewUrl: '' });
          setReferenceMode(restoredReferenceMode);
          setReferenceFrames((saved.referenceFrames || []).slice(0, 9).map(frame => ({ ...frame, previewUrl: '' })));
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
      version: 3,
      nodes,
      prompt,
      model,
      duration,
      aspectRatio,
      resolution,
      shot,
      startFrame: stripUrl(startFrame),
      endFrame: stripUrl(endFrame),
      referenceMode,
      referenceFrames: referenceFrames.map(frame => stripUrl(frame)).filter((frame): frame is Omit<UploadedFrame, 'previewUrl'> => Boolean(frame)),
      generationId: generation?.id || restoredGenerationId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [aspectRatio, duration, endFrame, generation?.id, hydrated, model, nodes, prompt, referenceFrames, referenceMode, resolution, restoredGenerationId, shot, startFrame]);

  useEffect(() => {
    if (!hasAccount) {
      return;
    }
    let cancelled = false;
    // Loading model capabilities is an external request; keep the loading
    // marker separate from the render-derived signed-out state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccess('loading');
    loadVideoModels().then(next => {
      if (cancelled) return;
      setHistory([]);
      setHistoryHasMore(false);
      setHistoryError('');
      setHistoryOpen(false);
      setModels(next);
      setAccess('ready');
      setModel(currentModel => {
        const current = next.find(item => item.id === currentModel);
        if (current?.enabled) return currentModel;
        const enabled = next.find(item => item.enabled && item.id !== 'auto');
        return enabled?.id || currentModel;
      });
    }).catch(cause => {
      if (cancelled) return;
      const typed = cause as VideoGenerationClientError;
      setAccess(typed.code === 'TEAM_ONLY' ? 'team-only' : 'error');
      setError(clientMessage(cause));
    });
    return () => { cancelled = true; };
  }, [account?.accessToken, hasAccount]);

  useEffect(() => {
    if (effectiveAccess !== 'ready') return;
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
        const missingReferences = referenceFrames.filter(frame => !frame.previewUrl);
        if (missingReferences.length) {
          const urls = await Promise.all(missingReferences.map(async frame => [frame.assetId, await loadVideoAssetUrl(frame.assetId)] as const));
          if (!cancelled) {
            const byAssetId = new Map(urls);
            setReferenceFrames(current => current.map(frame => ({ ...frame, previewUrl: frame.previewUrl || byAssetId.get(frame.assetId) || '' })));
          }
        }
        if (restoredGenerationId && !generation) {
          const next = await refreshVideoGeneration(restoredGenerationId);
          if (!cancelled) {
            setGeneration(next);
            rememberGeneration(next);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(clientMessage(cause));
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [effectiveAccess, endFrame, generation, referenceFrames, rememberGeneration, restoredGenerationId, startFrame]);

  useEffect(() => {
    if (!generationId || !generationStatus || !['queued', 'processing'].includes(generationStatus)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshVideoGeneration(generationId);
        if (cancelled) return;
        setGeneration(next);
        rememberGeneration(next);
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
  }, [generationId, generationStatus, rememberGeneration]);

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

  useEffect(() => {
    referenceFramesRef.current = referenceFrames;
  }, [referenceFrames]);

  useEffect(() => () => {
    referenceFramesRef.current.forEach(frame => {
      if (frame.previewUrl.startsWith('blob:')) URL.revokeObjectURL(frame.previewUrl);
    });
  }, []);

  const uploadFrame = async (file: File): Promise<UploadedFrame> => {
    const dimensions = await imageDimensions(file);
    const assetId = await uploadVideoInput(file);
    return { assetId, name: file.name, previewUrl: URL.createObjectURL(file), ...dimensions };
  };

  const upload = async (slot: 'start' | 'end', file: File) => {
    setUploading(slot);
    setError('');
    try {
      const next = await uploadFrame(file);
      if (slot === 'start') setStartFrame(next); else setEndFrame(next);
      notify(zh ? '图片已上传到私有工作区。' : 'Image uploaded to the private workspace.');
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setUploading(null);
    }
  };

  const uploadReferences = async (files: File[]) => {
    const capacity = 9 - referenceFrames.length;
    if (capacity <= 0) {
      setError(zh ? '全能参考最多支持 9 张图片。' : 'Omni reference supports up to 9 images.');
      return;
    }
    const selected = files.slice(0, capacity);
    setUploading('reference');
    setError('');
    try {
      const settled = await Promise.allSettled(selected.map(uploadFrame));
      const uploaded = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      const failed = settled.find(result => result.status === 'rejected');
      if (uploaded.length) {
        setReferenceFrames(current => [...current, ...uploaded].slice(0, 9));
        notify(zh ? `已加入 ${uploaded.length} 张全能参考图片。` : `${uploaded.length} omni reference images added.`);
      }
      if (failed?.status === 'rejected') setError(clientMessage(failed.reason));
      if (files.length > capacity) setError(zh ? `已达到 9 张上限，未加入其余 ${files.length - capacity} 张。` : `The 9-image limit was reached; ${files.length - capacity} files were skipped.`);
    } finally {
      setUploading(null);
    }
  };

  const removeReference = (index: number) => {
    setReferenceFrames(current => {
      const target = current[index];
      if (target?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const mentionReference = (index: number) => {
    const mention = zh ? `@图片${index + 1}` : `@image${index + 1}`;
    setPrompt(current => current.includes(mention) ? current : `${current.trim()} ${mention} `.trimStart());
  };

  const changeReferenceMode = (next: ReferenceMode) => {
    setReferenceMode(next);
    if (next === 'omni') {
      if (model !== 'minimax-h3' && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p');
    }
  };

  const selectModel = (next: VideoModelId) => {
    // MiniMax H3 supports both FL2VA (start/end) and Ref2VA (multi-reference)
    // inputs. Keep the model selectable in either reference mode.
    setModel(next);
    setDuration(current => normalizeVideoDuration(next, current));
    if (next === 'minimax-h3') setResolution('768P');
    if (['seedance-2', 'seedance-2-5'].includes(next) && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p');
  };

  const planWithAgent = async () => {
    if (planning) return;
    if (!prompt.trim()) {
      setError(zh ? '先写一段 Motion Prompt，再让 Agent 规划。' : 'Add a Motion Prompt before asking the Agent to plan.');
      return;
    }
    setPlanning(true);
    setError('');
    try {
      const next = await planVideoGeneration({
        prompt: prompt.trim(),
        preferredModel: model,
        referenceMode,
        referenceCount: referenceMode === 'omni' ? referenceFrames.length : (startFrame ? 1 : 0) + (endFrame ? 1 : 0),
        referenceImageAssetIds: referenceMode === 'omni' ? referenceFrames.map(frame => frame.assetId) : [],
        duration,
        aspectRatio,
        resolution,
      });
      setAgentPlan(next);
      setModel(next.model);
      setReferenceMode(next.referenceMode);
      setDuration(next.duration);
      if (next.aspectRatio) setAspectRatio(next.aspectRatio);
      setResolution(next.resolution);
      notify(zh ? `Agent 已完成规划：${next.modelLabel}。请确认后再生成。` : `Agent selected ${next.modelLabel}. Review the plan before generating.`);
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setPlanning(false);
    }
  };

  const focusMotionPrompt = () => {
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAgentAction = () => {
    if (!prompt.trim()) {
      focusMotionPrompt();
      return;
    }
    void planWithAgent();
  };

  const closeNodePalette = () => setNodePaletteOpen(false);
  const toggleNodePalette = () => {
    setNodePaletteOpen(current => {
      const next = !current;
      if (next) setHistoryOpen(false);
      return next;
    });
  };
  const handlePaletteImage = (file: File) => {
    if (referenceMode === 'omni') void uploadReferences([file]);
    else void upload('start', file);
  };
  const addTextNode = () => {
    closeNodePalette();
    focusMotionPrompt();
  };
  const addVideoNode = () => {
    closeNodePalette();
    const readyModel = models.find(item => item.enabled && item.id !== 'auto');
    if (!selectedModel?.enabled && readyModel) selectModel(readyModel.id);
    focusMotionPrompt();
    notify(zh ? `视频生成节点已就绪：${modelName(readyModel?.id || model)}。请在下方补齐参数。` : `Video generation is ready with ${modelName(readyModel?.id || model)}. Complete the settings below.`);
  };
  const addReferenceNode = () => {
    setReferenceMode('omni');
    closeNodePalette();
    notify(zh ? '已切换到全能参考，可在画布左侧加入最多 9 张图片。' : 'Omni reference is ready. Add up to 9 images from the left node.');
  };

  const generate = async () => {
    const primaryFrame = referenceMode === 'omni' ? referenceFrames[0] : startFrame;
    if (!canGenerate || !primaryFrame) return;
    setSubmitting(true);
    setError('');
    setVideoUrl('');
    try {
      if (model === 'minimax-h3') {
        if (referenceMode === 'omni') referenceFrames.forEach((frame, index) => assertMiniMaxFrame(frame, `${zh ? '参考图' : 'Reference image'} ${index + 1}`));
        else if (startFrame) {
          assertMiniMaxFrame(startFrame, 'START');
          if (endFrame) assertMiniMaxFrame(endFrame, 'END');
        }
      }
      const next = await createVideoGeneration({
        model,
        prompt: prompt.trim(),
        startImageAssetId: primaryFrame.assetId,
        endImageAssetId: referenceMode === 'start-end' ? endFrame?.assetId || null : null,
        referenceMode,
        referenceImageAssetIds: referenceMode === 'omni' ? referenceFrames.map(frame => frame.assetId) : [],
        duration,
        aspectRatio,
        resolution,
      });
      setGeneration(next);
      rememberGeneration(next);
      setRestoredGenerationId(next.id);
      notify(zh ? '镜头任务已创建，画布会自动同步进度。' : 'Shot created. The canvas will sync progress automatically.');
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithResult = async () => {
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
      setReferenceMode('start-end');
      setReferenceFrames([]);
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
        x: clamp(drag.origin.x + dx, 0, STAGE_SIZE.width - nodeSize[drag.id].width),
        y: clamp(drag.origin.y + dy, 0, STAGE_SIZE.height - nodeSize[drag.id].height),
      },
    }));
  };
  const endNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };
  const moveNodeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>, id: NodeId) => {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const distance = event.shiftKey ? 48 : 16;
    setNodes(previous => ({
      ...previous,
      [id]: {
        x: clamp(previous[id].x + direction.x * distance, 0, STAGE_SIZE.width - nodeSize[id].width),
        y: clamp(previous[id].y + direction.y * distance, 0, STAGE_SIZE.height - nodeSize[id].height),
      },
    }));
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.video-canvas-node, .video-canvas-toolbar, .video-canvas-composer')) return;
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

  const toggleCanvasFullscreen = async () => {
    setPreferencesOpen(false);
    if (fullscreenFallbackRef.current) {
      fullscreenFallbackRef.current = false;
      setIsCanvasFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (cause) {
        setError(clientMessage(cause));
      }
      return;
    }
    const canvas = canvasShellRef.current;
    if (!canvas?.requestFullscreen) {
      fullscreenFallbackRef.current = true;
      setIsCanvasFullscreen(true);
      return;
    }
    try {
      await canvas.requestFullscreen();
    } catch {
      // Some embedded browsers expose the API but reject the permission. The
      // fixed immersive fallback still keeps the canvas usable in that case.
      fullscreenFallbackRef.current = true;
      setIsCanvasFullscreen(true);
    }
  };

  const edges = useMemo(() => CONNECTIONS.map(([from, to]) => {
    const start = {
      x: nodes[from].x + nodeSize[from].width,
      y: nodes[from].y + nodeSize[from].height / 2,
    };
    const end = {
      x: nodes[to].x,
      y: nodes[to].y + nodeSize[to].height / 2,
    };
    const curve = Math.max(90, Math.abs(end.x - start.x) * 0.45);
    return {
      id: from + '-' + to,
      d: 'M ' + start.x + ' ' + start.y + ' C ' + (start.x + curve) + ' ' + start.y + ', ' + (end.x - curve) + ' ' + end.y + ', ' + end.x + ' ' + end.y,
    };
  }), [nodeSize, nodes]);

  if (effectiveAccess === 'signed-out') return <main className="app-page video-canvas-access"><span>AI CANVAS</span><h1>{zh ? '登录后进入镜头画布。' : 'Sign in to open the shot canvas.'}</h1><p>{zh ? '画布使用现有团队生成服务，不会在浏览器保存第三方密钥。' : 'The canvas uses the existing Team service and never stores provider keys in the browser.'}</p><button type="button" className="primary" onClick={onSignIn}>{zh ? '使用 Google 登录' : 'Sign in with Google'}</button></main>;
  if (effectiveAccess === 'team-only') return <main className="app-page video-canvas-access denied"><span>TEAM ACCESS</span><h1>{zh ? '这个账号还没有 AI 画布权限。' : 'This account does not have AI Canvas access.'}</h1><p>{zh ? '请让站点主人在账号目录中开通 Team 权限。' : 'Ask the owner to grant Team access in the account directory.'}</p></main>;

  return <main className="app-page video-canvas-page">
    <header className="video-canvas-intro">
      <div><span>AI STUDIO · SHOT CANVAS</span><h1>{zh ? '把镜头思路铺开，再交给模型。' : 'Lay out the shot before handing it to the model.'}</h1><p>{zh ? '拖拽节点组织一次图生视频任务；底层仍复用现有 Provider、异步任务、积分和媒体存储。' : 'Arrange one image-to-video task with draggable nodes while reusing the existing providers, task lifecycle, credits, and storage.'}</p></div>
      <aside><b>{zh ? '画布状态' : 'Canvas state'}</b><span>{zh ? '当前设备自动保存' : 'Auto-saved on this device'}</span><button type="button" onClick={() => { setNodes(INITIAL_NODES); setViewport(INITIAL_VIEWPORT); }}>{zh ? '整理画布' : 'Tidy canvas'}</button></aside>
    </header>

    <div className="video-canvas-model-pill" role="status" aria-live="polite">
      <span className="video-canvas-model-mark" aria-hidden="true">✦</span>
      <span className="video-canvas-model-copy"><b>{modelName(model)}</b><small>{selectedModel?.enabled ? (zh ? '已就绪 · Team 可用' : 'Ready · Team access') : (zh ? '待配置服务端模型' : 'Provider configuration required')}</small></span>
      <span className={'video-canvas-model-state ' + (selectedModel?.enabled ? 'ready' : 'pending')}><i />{selectedModel?.enabled ? (zh ? '已上线' : 'Online') : (zh ? '待配置' : 'Pending')}</span>
      <span className="video-canvas-model-spec">{duration} · {resolution}</span>
    </div>

    {error && <div className="video-canvas-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>{zh ? '关闭' : 'Dismiss'}</button></div>}

    <section ref={canvasShellRef} className={'video-canvas-shell ' + (isCanvasFullscreen ? 'is-canvas-fullscreen' : '')} aria-label={zh ? 'AI 图生视频无限画布' : 'AI image-to-video infinite canvas'}>
      <div className="video-canvas-caption">
        <div className="video-canvas-caption-project"><span className="canvas-project-mark" aria-hidden="true">SC</span><div><b>{zh ? '未命名镜头项目' : 'Untitled shot project'}</b><small><i aria-hidden="true" />{zh ? '已保存到本地' : 'Saved locally'}</small></div></div>
        <div className="video-canvas-caption-center"><span>{String(shot).padStart(2, '0')} · {zh ? '当前镜头' : 'Current shot'}</span><p>{zh ? '拖动空白区域移动画布，滚轮缩放。' : 'Drag the background to pan, use the wheel to zoom.'}</p></div>
        <div className="video-canvas-caption-actions"><button type="button" className={'canvas-add-node-trigger ' + (nodePaletteOpen ? 'is-open' : '')} aria-expanded={nodePaletteOpen} aria-controls="canvas-node-palette" onClick={toggleNodePalette}><span aria-hidden="true">＋</span>{nodePaletteOpen ? (zh ? '关闭面板' : 'Close panel') : (zh ? '添加节点' : 'Add node')}</button></div>
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
          <button type="button" onClick={() => setViewport(INITIAL_VIEWPORT)}>{zh ? '回到流程' : 'Fit'}</button>
          <button type="button" className="canvas-history-toolbar-button" aria-expanded={historyOpen} aria-controls="canvas-history-panel" onClick={toggleHistory} aria-label={historyOpen ? (zh ? '关闭生成历史' : 'Close generation history') : (zh ? '打开生成历史' : 'Open generation history')} title={historyOpen ? (zh ? '关闭生成历史' : 'Close generation history') : (zh ? '打开生成历史' : 'Open generation history')}><span aria-hidden="true">▤</span><b>{zh ? '历史' : 'History'}</b>{history.length > 0 && <i aria-hidden="true">{history.length > 99 ? '99+' : history.length}</i>}</button>
          <button type="button" className="canvas-fullscreen-button" onClick={() => void toggleCanvasFullscreen()} aria-label={isCanvasFullscreen ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '进入全屏' : 'Enter fullscreen')} title={isCanvasFullscreen ? (zh ? '退出全屏（Esc）' : 'Exit fullscreen (Esc)') : (zh ? '进入全屏' : 'Enter fullscreen')}><span aria-hidden="true">{isCanvasFullscreen ? '↙' : '⛶'}</span><b>{isCanvasFullscreen ? (zh ? '退出' : 'Exit') : (zh ? '全屏' : 'Full')}</b></button>
        </div>
        <div className="video-canvas-stage" style={{ width: STAGE_SIZE.width, height: STAGE_SIZE.height, transform: 'translate(' + viewport.x + 'px,' + viewport.y + 'px) scale(' + viewport.scale + ')' }}>
          <svg className="video-canvas-edges" width={STAGE_SIZE.width} height={STAGE_SIZE.height} aria-hidden="true">
            {edges.map(edge => <g key={edge.id}><path className="edge-shadow" d={edge.d} /><path d={edge.d} /></g>)}
          </svg>

          <article className="video-canvas-node source-node" style={{ left: nodes.source.x, top: nodes.source.y, width: nodeSize.source.width, minHeight: nodeSize.source.height }}>
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '镜头边界节点。拖动，或使用方向键移动。' : 'Shot boundary node. Drag it or use the arrow keys to move it.'} onKeyDown={event => moveNodeWithKeyboard(event, 'source')} onPointerDown={event => startNodeDrag(event, 'source')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>01</span><b>{zh ? '镜头边界' : 'Shot boundary'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body">
              {referenceMode === 'start-end' ? <>
                <UploadControl label="START" zh={zh} value={startFrame} busy={uploading === 'start'} onSelect={file => void upload('start', file)} onRemove={() => setStartFrame(null)} />
                <UploadControl label="END" zh={zh} optional value={endFrame} busy={uploading === 'end'} onSelect={file => void upload('end', file)} onRemove={() => setEndFrame(null)} />
              </> : <div className="canvas-omni-node">
                <div className="canvas-omni-node-head"><b>{zh ? '全能参考' : 'Omni reference'}</b><span>{referenceFrames.length}/9</span></div>
                <div className="canvas-omni-grid">
                  {referenceFrames.map((frame, index) => <OmniReferenceChip key={frame.assetId} frame={frame} mentionLabel={zh ? `@图片${index + 1}` : `@image${index + 1}`} loadingLabel={zh ? '读取中' : 'Loading'} removeLabel={zh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`} onMention={() => mentionReference(index)} onRemove={() => removeReference(index)} />)}
                  {referenceFrames.length < 9 && <label className="canvas-omni-add"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { void uploadReferences(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><span>＋</span><b>{uploading === 'reference' ? (zh ? '上传中' : 'Uploading') : (zh ? '加入图片' : 'Add images')}</b></label>}
                </div>
                <small>{zh ? '点击 @图片编号，把素材引用插入提示词。' : 'Use an @image label to reference a source in the prompt.'}</small>
              </div>}
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node agent-node" style={{ left: nodes.agent.x, top: nodes.agent.y, width: nodeSize.agent.width, minHeight: nodeSize.agent.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? 'Agent 导演节点。拖动，或使用方向键移动。' : 'Agent director node. Drag it or use the arrow keys to move it.'} onKeyDown={event => moveNodeWithKeyboard(event, 'agent')} onPointerDown={event => startNodeDrag(event, 'agent')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>02</span><b>{zh ? 'Agent 导演' : 'Agent director'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-agent-body">
              <div className="canvas-agent-badge"><span aria-hidden="true">✦</span><b>{agentPlan ? agentPlan.director.label : 'GPT / Claude'}</b><small>{agentPlan ? (agentPlan.agentFallback ? (zh ? '规则回退' : 'Rules fallback') : (zh ? '已规划' : 'Planned')) : (zh ? '待规划' : 'Ready')}</small></div>
              {agentPlan ? <><strong>{agentPlan.modelLabel}</strong><p>{agentPlan.reasoning}</p>{agentPlan.referenceImageRoles && agentPlan.referenceImageRoles.length > 0 && <small className="canvas-agent-confidence">{zh ? `参考图：${agentPlan.referenceImageRoles.map(item => item.role).join(' · ')}` : `References: ${agentPlan.referenceImageRoles.map(item => item.role).join(' · ')}`}</small>}{typeof agentPlan.confidence === 'number' && <small className="canvas-agent-confidence">{zh ? `规划置信度 ${Math.round(agentPlan.confidence * 100)}%` : `${Math.round(agentPlan.confidence * 100)}% planning confidence`}</small>}{agentPlan.warnings.slice(0, 1).map(warning => <small key={warning} className="canvas-agent-warning">{warning}</small>)}</> : <p>{zh ? '理解 Prompt 和参考图，选择 H3 或 Seedance，再交给异步任务。' : 'Read the prompt and references, choose H3 or Seedance, then hand off to the async task.'}</p>}
              <button type="button" className="canvas-agent-plan-button" disabled={planning} title={agentPlanBlockedReason || undefined} onClick={handleAgentAction}>{planning ? (zh ? '规划中…' : 'Planning…') : prompt.trim() ? (zh ? '根据 Prompt 规划' : 'Plan from prompt') : (zh ? '填写 Prompt' : 'Add Prompt')}</button>
              {agentPlanBlockedReason && <small className="canvas-agent-prerequisite">{agentPlanBlockedReason}</small>}
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node task-node" style={{ left: nodes.task.x, top: nodes.task.y, width: nodeSize.task.width, minHeight: nodeSize.task.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '视频生成节点。拖动，或使用方向键移动。' : 'Video generation node. Drag it or use the arrow keys to move it.'} onKeyDown={event => moveNodeWithKeyboard(event, 'task')} onPointerDown={event => startNodeDrag(event, 'task')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>03</span><b>{zh ? '视频生成' : 'Video generation'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-task-body">
              <div className="canvas-task-model"><span className="canvas-task-model-icon" aria-hidden="true">▣</span><div><b>{modelName(model)}</b><small>{referenceMode === 'omni' ? (zh ? '全能参考 · 最多 9 张' : 'Omni · up to 9 images') : (zh ? '首尾帧参考' : 'Start / end')}</small></div><button type="button" onClick={() => setPreferencesOpen(true)}>{zh ? '设置' : 'Set'}</button></div>
              <div className="canvas-cost"><span>{selectedModel?.ownerUnlimited ? (zh ? '主人积分' : 'Owner credits') : (zh ? '预计消耗' : 'Estimated cost')}</span><b>{selectedModel?.ownerUnlimited ? (zh ? '无限' : 'Unlimited') : estimatedCredits ? estimatedCredits + ' cr' : '—'}</b></div>
              <ul><li className={hasReferenceInput ? 'done' : ''}>{referenceMode === 'omni' ? (zh ? `${referenceFrames.length}/9 参考图片` : `${referenceFrames.length}/9 references`) : (zh ? 'START 图片' : 'START frame')}</li><li className={prompt.trim() ? 'done' : ''}>Motion Prompt</li><li className={selectedModel?.enabled && referenceModeSupported ? 'done' : ''}>{zh ? '模型可用' : 'Model ready'}</li></ul>
              <div className={'canvas-task-state ' + (generation?.status || 'draft')}><span />{generation ? statusLabel(generation.status, zh) : (zh ? '等待提交' : 'Ready to submit')}</div>
              {!generation && <strong className={'canvas-task-next ' + (canGenerate ? 'ready' : '')}>{canGenerate ? (zh ? '参数已齐，可以生成' : 'Ready to generate') : generationBlockedReason}</strong>}
              <small>{zh ? '在底部生成台补齐参数并提交。仅成功后扣除积分。' : 'Complete the settings in the composer below. Credits settle only on success.'}</small>
            </div>
            <span className="node-port output" aria-hidden="true" />
          </article>

          <article className="video-canvas-node result-node" style={{ left: nodes.result.x, top: nodes.result.y, width: nodeSize.result.width, minHeight: nodeSize.result.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '视频结果节点。拖动，或使用方向键移动。' : 'Video result node. Drag it or use the arrow keys to move it.'} onKeyDown={event => moveNodeWithKeyboard(event, 'result')} onPointerDown={event => startNodeDrag(event, 'result')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>04</span><b>{zh ? '视频结果' : 'Video result'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-result-body" aria-live="polite">
              {!generation ? <div className="canvas-result-empty"><span aria-hidden="true">▶</span><b>{zh ? '等待镜头任务' : 'Waiting for a shot'}</b><p>{zh ? '完成左侧节点后，结果和进度会自动出现在这里。' : 'Complete the upstream nodes and the result will appear here.'}</p></div> : <>
                <div className={'canvas-status ' + generation.status}><b>{statusLabel(generation.status, zh)}</b><span>{generation.progress}%</span></div>
                {['queued', 'processing'].includes(generation.status) && <div className="canvas-progress"><i style={{ width: Math.max(4, progress) + '%' }} /></div>}
                {videoUrl ? <video src={videoUrl} controls playsInline preload="metadata" /> : generation.status === 'completed' ? <div className="canvas-media-loading">{zh ? '正在读取私有视频…' : 'Loading private video…'}</div> : null}
                {generation.status === 'failed' && <p className="canvas-failure">{generation.errorMessage || (zh ? '模型未完成本次生成。' : 'The model did not finish this generation.')}</p>}
                <dl><div><dt>{zh ? '模型' : 'Model'}</dt><dd>{modelName(generation.model)}</dd></div><div><dt>{zh ? '规格' : 'Format'}</dt><dd>{generation.duration} · {generation.aspectRatio} · {generation.resolution}</dd></div></dl>
                <div className="canvas-result-actions"><button type="button" disabled={!generation.videoAssetId} onClick={() => void download()}>{zh ? '下载' : 'Download'}</button><button type="button" disabled={!generation.thumbnailAssetId} onClick={() => void continueWithResult()}>{zh ? '设为下一镜头 START' : 'Use as next START'}</button></div>{generation.thumbnailAssetId && <small>{zh ? '下一镜头将使用结果缩略帧作为 START。' : 'The next shot will use the result thumbnail as START.'}</small>}
                {!generation.thumbnailAssetId && generation.status === 'completed' && <small>{zh ? '模型未返回可复用的结果帧；视频仍可下载。' : 'The model did not return a reusable result frame; the video remains downloadable.'}</small>}
              </>}
            </div>
              </article>
            </div>
          </div>

      {nodePaletteOpen && <aside id="canvas-node-palette" className="canvas-node-palette" role="region" aria-labelledby="canvas-node-palette-title" onKeyDown={event => { if (event.key === 'Escape') closeNodePalette(); }}>
        <div className="canvas-node-palette-head"><div><span>{zh ? '工作区工具' : 'WORKSPACE TOOLS'}</span><b id="canvas-node-palette-title">{zh ? '添加节点' : 'Add a node'}</b><small>{zh ? '把输入素材放进当前镜头。' : 'Bring an input into the current shot.'}</small></div><button type="button" className="canvas-node-palette-close" aria-label={zh ? '关闭添加节点面板' : 'Close add node panel'} onClick={closeNodePalette}>×</button></div>
        <div className="canvas-node-palette-section"><span>{zh ? '节点' : 'NODES'}</span><div className="canvas-node-palette-grid">
          <button type="button" className="canvas-node-palette-item" onClick={addTextNode}><span aria-hidden="true">≡</span><b>{zh ? '文本' : 'Text'}</b><small>{zh ? '写 Motion Prompt' : 'Write a motion prompt'}</small></button>
          <label className="canvas-node-palette-item"><input ref={paletteImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { handlePaletteImage(file); closeNodePalette(); } event.currentTarget.value = ''; }} /><span aria-hidden="true">▧</span><b>{zh ? '图片' : 'Image'}</b><small>{zh ? '加入 START / 参考图' : 'Add START / reference'}</small></label>
          <button type="button" className="canvas-node-palette-item" onClick={addVideoNode}><span aria-hidden="true">▣</span><b>{zh ? '视频' : 'Video'}</b><em className="canvas-node-palette-badge">{selectedModel?.enabled ? modelName(model) : (zh ? '选择模型' : 'Choose model')}</em><small>{zh ? '选择模型并写动作提示' : 'Choose a model and prompt'}</small></button>
          <button type="button" className="canvas-node-palette-item is-disabled" disabled><span aria-hidden="true">▥</span><b>{zh ? '音频' : 'Audio'}</b><small>{zh ? '配音阶段开放' : 'Coming with audio'}</small></button>
        </div></div>
        <div className="canvas-node-palette-section"><span>{zh ? '素材' : 'ASSETS'}</span><div className="canvas-node-palette-list">
          <label className="canvas-node-palette-row"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { handlePaletteImage(file); closeNodePalette(); } event.currentTarget.value = ''; }} /><span aria-hidden="true">↥</span><div><b>{zh ? '本地上传' : 'Local upload'}</b><small>{zh ? '从设备加入图片素材' : 'Add an image from this device'}</small></div></label>
          <button type="button" className="canvas-node-palette-row" onClick={addReferenceNode}><span aria-hidden="true">@</span><div><b>{zh ? '引用参考' : 'Reference set'}</b><small>{zh ? '切换到最多 9 张全能参考' : 'Switch to up to 9 omni references'}</small></div></button>
        </div></div>
      </aside>}

      {historyOpen && <aside id="canvas-history-panel" className="canvas-history-panel" role="region" aria-labelledby="canvas-history-title" onKeyDown={event => { if (event.key === 'Escape') setHistoryOpen(false); }}>
        <div className="canvas-history-head">
          <div><span>{zh ? '任务档案' : 'TASK ARCHIVE'}</span><b id="canvas-history-title">{zh ? '生成历史' : 'Generation history'}</b><small>{zh ? '当前 Team 账号的最近任务' : 'Recent tasks for this Team account'}</small></div>
          <button type="button" className="canvas-history-close" aria-label={zh ? '关闭生成历史' : 'Close generation history'} onClick={() => setHistoryOpen(false)}>×</button>
        </div>
        {historyLoading ? <p className="canvas-history-state">{zh ? '正在读取历史任务…' : 'Loading generation history…'}</p> : historyError ? <div className="canvas-history-error"><p>{historyError}</p><button type="button" onClick={() => void loadHistoryPage(false)}>{zh ? '重试' : 'Retry'}</button></div> : history.length ? <div className="canvas-history-list">{history.map(item => <button type="button" className={'canvas-history-row ' + (generation?.id === item.id ? 'is-current' : '')} key={item.id} onClick={() => restoreHistoryItem(item)}><span className="canvas-history-status" data-status={item.status} aria-hidden="true" /><span className="canvas-history-row-copy"><b>{item.prompt || (zh ? '未命名镜头' : 'Untitled shot')}</b><small>{modelName(item.model)} · {item.duration} · {formatHistoryTime(item.createdAt, zh)}</small></span><span className="canvas-history-row-meta"><strong>{statusLabel(item.status, zh)}</strong><small>{item.creditsCost ? item.creditsCost + ' cr' : (zh ? '主人无限' : 'Owner')}</small></span></button>)}</div> : <div className="canvas-history-empty"><span aria-hidden="true">✦</span><p>{zh ? '还没有生成任务。' : 'No generation tasks yet.'}</p><small>{zh ? '提交第一条镜头后，它会自动出现在这里。' : 'Your first submitted shot will appear here.'}</small></div>}
        {history.length > 0 && historyHasMore && <button type="button" className="canvas-history-more" disabled={historyLoadingMore} onClick={() => void loadHistoryPage(true)}>{historyLoadingMore ? (zh ? '正在加载…' : 'Loading…') : (zh ? '加载更多' : 'Load more')}</button>}
        <p className="canvas-history-footnote">{zh ? '点击任务可载入当前画布；不会重新提交模型。' : 'Select a task to load it here; no model request is submitted.'}</p>
      </aside>}

      <section className="video-canvas-composer" aria-label={zh ? '视频生成控制台' : 'Video generation composer'}>
          <div className={'canvas-composer-media ' + (referenceMode === 'omni' ? 'is-omni' : '')} aria-label={zh ? '参考图片' : 'Reference images'}>
            {referenceMode === 'start-end' ? <>
            <label className={'canvas-reference-chip ' + (startFrame ? 'has-media' : '')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void upload('start', file); event.currentTarget.value = ''; }} />
              {startFrame?.previewUrl ? <img src={startFrame.previewUrl} alt="" /> : <span aria-hidden="true">＋</span>}
              <b>START</b><small>{startFrame ? (zh ? '更换' : 'Replace') : (zh ? '必需' : 'Required')}</small>
            </label>
            <label className={'canvas-reference-chip ' + (endFrame ? 'has-media' : '')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void upload('end', file); event.currentTarget.value = ''; }} />
              {endFrame?.previewUrl ? <img src={endFrame.previewUrl} alt="" /> : <span aria-hidden="true">＋</span>}
              <b>END</b><small>{endFrame ? (zh ? '更换' : 'Replace') : (zh ? '可选' : 'Optional')}</small>
            </label>
            </> : <>
              {referenceFrames.map((frame, index) => <OmniReferenceChip key={frame.assetId} frame={frame} mentionLabel={zh ? `@图片${index + 1}` : `@image${index + 1}`} loadingLabel={zh ? '读取中' : 'Loading'} removeLabel={zh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`} onMention={() => mentionReference(index)} onRemove={() => removeReference(index)} />)}
              {referenceFrames.length < 9 && <label className="canvas-reference-chip canvas-omni-composer-add"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { void uploadReferences(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><span aria-hidden="true">＋</span><b>{zh ? '参考图' : 'Reference'}</b><small>{referenceFrames.length}/9</small></label>}
            </>}
          </div>

          <div className="canvas-composer-main">
            <div className="canvas-composer-prompt">
              <div className="canvas-composer-prompt-head"><label htmlFor="canvas-motion-prompt">Motion Prompt</label><small>{prompt.trim() ? (zh ? '已填写' : 'Ready') : (zh ? '必需' : 'Required')}</small></div>
              <textarea ref={promptRef} id="canvas-motion-prompt" value={prompt} maxLength={1200} rows={2} onChange={event => { setPrompt(event.target.value); setAgentPlan(null); }} placeholder={zh ? '描述主体动作、镜头运动、节奏与光线变化…' : 'Describe subject motion, camera movement, pacing, and light…'} />
              <span className="canvas-composer-count">{prompt.length}/1200</span>
            </div>
            <div className="canvas-composer-controls">
              <div className="canvas-preferences-wrap">
                <button
                  type="button"
                  className={'canvas-preferences-trigger ' + (preferencesOpen ? 'is-open' : '')}
                  aria-expanded={preferencesOpen}
                  aria-controls="canvas-preferences-panel"
                  onClick={() => setPreferencesOpen(current => !current)}
                >
                  <span className="canvas-preferences-trigger-icon" aria-hidden="true">☷</span>
                  <span className="canvas-preferences-trigger-copy">
                    <b>{zh ? '生成偏好' : 'Preferences'}</b>
                    <small>{modelName(model)} · {referenceMode === 'omni' ? (zh ? '全能参考' : 'Omni') : (zh ? '首尾帧' : 'Start / end')} · {aspectRatio}</small>
                  </span>
                  <span className="canvas-preferences-trigger-arrow" aria-hidden="true">{preferencesOpen ? '⌃' : '⌄'}</span>
                </button>
                {preferencesOpen && <div id="canvas-preferences-panel" className="canvas-preferences-panel" role="region" aria-labelledby="canvas-preferences-title" onKeyDown={event => { if (event.key === 'Escape') setPreferencesOpen(false); }}>
                  <div className="canvas-preferences-head">
                    <div><span>{zh ? '生成偏好' : 'Generation preferences'}</span><b id="canvas-preferences-title">{zh ? '把这一镜头的参数收在一起' : 'Keep this shot’s settings together'}</b></div>
                    <button type="button" className="canvas-preferences-close" aria-label={zh ? '关闭生成偏好' : 'Close generation preferences'} onClick={() => setPreferencesOpen(false)}>×</button>
                  </div>
                  <div className="canvas-preferences-auto" aria-disabled="true">
                    <div><b>{zh ? '智能推荐' : 'Auto recommend'}</b><small>{zh ? '根据 Prompt 自动选择模型（即将开放）' : 'Choose a model from the prompt (coming soon)'}</small></div>
                    <span className="canvas-preferences-toggle" aria-hidden="true"><i /></span>
                  </div>
                  <div className="canvas-preferences-grid">
                    <label className="canvas-preference-field canvas-preference-field-wide"><span>{zh ? '模型' : 'Model'}</span><select value={model} onChange={event => selectModel(event.target.value as VideoModelId)}><option value="auto" disabled>Auto · {zh ? '即将开放' : 'Coming soon'}</option>{models.filter(item => item.id !== 'auto').map(item => <option key={item.id} value={item.id}>{modelName(item.id)}{item.enabled ? '' : ' · ' + (zh ? '未就绪' : 'Not ready')}</option>)}</select></label>
                    <label className="canvas-preference-field canvas-preference-field-wide"><span>{zh ? '参考模式' : 'Reference mode'}</span><select value={referenceMode} onChange={event => changeReferenceMode(event.target.value as ReferenceMode)}><option value="start-end">{zh ? '首尾帧参考' : 'Start / end'}</option><option value="omni">{zh ? '全能参考 · 多图' : 'Omni · multi-image'}</option></select></label>
                    <fieldset className="canvas-preference-field canvas-preference-ratio-field"><legend>{zh ? '画幅' : 'Aspect ratio'}</legend><div className="canvas-preference-ratios">{ASPECT_RATIO_OPTIONS.map(option => {
                      const disabled = model === 'minimax-h3' && referenceMode !== 'omni';
                      return <button key={option.value} type="button" className={'canvas-ratio-option ' + (aspectRatio === option.value ? 'is-selected ' : '') + option.className} aria-pressed={aspectRatio === option.value} disabled={disabled} onClick={() => setAspectRatio(option.value)}><span className="canvas-ratio-icon" aria-hidden="true" /><b>{option.label}</b></button>;
                    })}</div></fieldset>
                    <label className="canvas-preference-field"><span>{zh ? '分辨率' : 'Resolution'}</span><select value={resolution} onChange={event => setResolution(event.target.value)}>{(model === 'minimax-h3' ? ['768P', '2K'] : ['480p', '720p', '1080p']).map(value => <option key={value}>{value}</option>)}</select></label>
                    <label className="canvas-preference-field"><span>{zh ? '时长' : 'Duration'}</span><select value={duration} onChange={event => setDuration(event.target.value)}>{videoDurationOptions(model).map(value => <option key={value}>{value}</option>)}</select></label>
                  </div>
                  <div className="canvas-preferences-footer"><span>{zh ? '生成数量' : 'Outputs'}</span><b>1 <small>{zh ? '当前单条生成' : 'single output for now'}</small></b><em>{zh ? '设置会自动保存到本地' : 'Settings save locally'}</em></div>
                </div>}
              </div>
              <div className="canvas-composer-cost"><small>{zh ? '预计积分' : 'Credits'}</small><b>{selectedModel?.ownerUnlimited ? '∞' : estimatedCredits || '—'}</b></div>
              <button type="button" className="canvas-agent-inline-button" disabled={planning} title={agentPlanBlockedReason || undefined} onClick={handleAgentAction}>{planning ? (zh ? '规划中…' : 'Planning…') : prompt.trim() ? (zh ? 'Agent 规划' : 'Agent plan') : (zh ? '填写 Prompt' : 'Add Prompt')}</button>
              <button type="button" className="canvas-composer-generate" disabled={!canGenerate} title={generationBlockedReason || undefined} onClick={() => void generate()}>{submitting ? <><span className="canvas-submit-spinner" aria-hidden="true" />{zh ? '提交中' : 'Submitting'}</> : <>{zh ? '生成视频' : 'Generate video'}<span aria-hidden="true">→</span></>}</button>
            </div>
            {agentPlan && <div className="canvas-agent-plan-result" aria-live="polite"><div><b>{agentPlan.agentFallback ? (zh ? '规则规划已接管' : 'Rules fallback is active') : (zh ? 'Agent 已生成方案' : 'Agent plan ready')}</b><span>{agentPlan.director.label} · {agentPlan.director.model} · {agentPlan.modelLabel} · {agentPlan.duration}{typeof agentPlan.confidence === 'number' ? ` · ${Math.round(agentPlan.confidence * 100)}%` : ''}</span></div><p>{agentPlan.reasoning}</p>{agentPlan.referenceImageRoles && agentPlan.referenceImageRoles.length > 0 && <small>{zh ? `参考图角色：${agentPlan.referenceImageRoles.map(item => `${item.index + 1} · ${item.role}`).join('、')}` : `Reference roles: ${agentPlan.referenceImageRoles.map(item => `${item.index + 1} · ${item.role}`).join(', ')}`}</small>}{agentPlan.imageModel && <small>{zh ? `缺少 START，可先用 ${agentPlan.imageModel} 准备首帧。` : `No START frame yet. Prepare one with ${agentPlan.imageModel}.`}</small>}{agentPlan.warnings.length > 0 && <ul>{agentPlan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}</div>}
            <p>{referenceMode === 'omni' ? (zh ? '全能参考支持 1–9 张图片；用 @图片编号说明人物、服装、场景或动作来源。MiniMax H3、Seedance 2.0 / 2.5 均可用。' : 'Omni reference accepts 1–9 images. Use @image labels to identify people, wardrobe, scenes, or motion. MiniMax H3 and Seedance 2.0 / 2.5 are supported.') : model === 'minimax-h3' ? (zh ? 'MiniMax H3 首尾帧模式将沿用 START 图片比例。' : 'MiniMax H3 start/end mode follows the START image ratio.') : (zh ? '任务异步运行；离开页面后仍会继续生成。失败不扣积分。' : 'Tasks continue asynchronously. Failed generations are not charged.')}</p>
          </div>
        </section>
    </section>
  </main>;
}
