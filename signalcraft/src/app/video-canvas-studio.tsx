'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';
import { CanvasCommandService, type CanvasNodePositions } from '@/src/lib/canvas-commands';
import {
  cloneFrame,
  createCanvasAgentContext,
  limitShotSnapshots,
  normalizeCustomEdges,
  normalizeCustomNodes,
  removeShotSnapshot,
  reorderShotSnapshots,
  restoreSavedShot,
  restoreScriptOcr,
  serializeShotSnapshot,
  stripFrame,
  sortShotSnapshots,
  upsertShotSnapshot,
  type CanvasCustomEdge,
  type CanvasCustomNode,
  type CanvasCustomNodeType,
  type CanvasReferenceMode,
  type PersistedFrame,
  type SavedShot,
  type ScriptOcrDraft,
  type ShotSnapshot,
  type UploadedFrame,
} from '@/src/lib/canvas-shot-workspace';
import {
  canvasVersionForGeneration,
  bindCanvasAssetReference,
  createCanvasSemantics,
  markCanvasAssetUnavailable,
  normalizeCanvasSemantics,
  parseCanvasAssetMentions,
  patchCanvasNode,
  patchCanvasShot,
  recordCanvasGeneration,
  recordCanvasEvent,
  registerCanvasAsset,
  selectCanvasBestTake,
  validateCanvasAssetMentions,
  type CanvasAgentAction,
  type CanvasAssetRole,
  type CanvasEventSemantic,
  type CanvasNodeId,
  type CanvasSemantics,
} from '@/src/lib/canvas-domain';
import { CANVAS_TEMPLATES, type CanvasTemplate } from '@/src/lib/canvas-templates';
import {
  createVideoGeneration,
  cancelVideoGeneration,
  estimateVideoCredits,
  estimateVideoGenerationTime,
  extractScriptText,
  formatVideoGenerationTime,
  formatVideoGenerationTimeRange,
  loadVideoHistory,
  loadVideoAsset,
  loadVideoAssetUrl,
  loadVideoModels,
  normalizeVideoDuration,
  planVideoGeneration,
  preflightVideoGeneration,
  refreshVideoGeneration,
  uploadVideoInput,
  videoDurationOptions,
  VideoGenerationClientError,
  type VideoGeneration,
  type VideoGenerationPlan,
  type VideoModel,
  type VideoModelId,
  type ScriptOcrResult,
} from '@/src/lib/video-generation';
import {
  analyzeShot,
  registryWithApiModels,
  routeShot,
  type ModelRoutingStrategy,
} from '@/src/lib/video-model-router';

type Point = { x: number; y: number };
type Viewport = Point & { scale: number };
type NodeId = CanvasNodeId;
type NodePositions = CanvasNodePositions;
type ReferenceMode = CanvasReferenceMode;
type PromptMentionCandidate = {
  frame: UploadedFrame;
  index: number;
  token: string;
  role: CanvasAssetRole;
};
type SavedCanvas = {
  version: 1 | 2 | 3 | 4 | 5;
  nodes: NodePositions;
  prompt: string;
  model: VideoModelId;
  routingStrategy?: ModelRoutingStrategy;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  shot: number;
  startFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  endFrame: Omit<UploadedFrame, 'previewUrl'> | null;
  referenceMode?: ReferenceMode;
  referenceFrames?: Array<Omit<UploadedFrame, 'previewUrl'>>;
  generationId: string | null;
  generationGroupId?: string | null;
  semantics?: CanvasSemantics;
  activeShot?: number;
  shots?: SavedShot[];
  scriptOcr?: ScriptOcrDraft | null;
  customNodes?: CanvasCustomNode[];
  customEdges?: CanvasCustomEdge[];
};

type ScriptOcrState = {
  assetId: string | null;
  status: 'idle' | 'processing' | 'ready' | 'error';
  text: string;
  result: ScriptOcrResult | null;
  error: string;
};

function scriptOcrDraftFromState(state: ScriptOcrState): ScriptOcrDraft | null {
  const text = state.text.replace(/\u0000/g, '').trim().slice(0, 12_000);
  const assetId = state.assetId?.trim().slice(0, 240) || '';
  if (!assetId || !text || state.status === 'processing') return null;
  return {
    assetId,
    text,
    extractedAt: state.result?.extractedAt || null,
  };
}

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
const CUSTOM_NODE_SIZE = { width: 286, height: 190 };
const CUSTOM_NODE_LABELS: Record<CanvasCustomNodeType, { zh: string; en: string; icon: string; hintZh: string; hintEn: string }> = {
  text: { zh: '文字', en: 'Text', icon: 'T', hintZh: '补充脚本、动作或镜头说明', hintEn: 'Add script, motion, or shot notes' },
  image: { zh: '图片', en: 'Image', icon: '▧', hintZh: '作为下一步视觉参考', hintEn: 'Use as the next visual reference' },
  video: { zh: '视频', en: 'Video', icon: '▶', hintZh: '关联一个视频结果或参考', hintEn: 'Link a video result or reference' },
  other: { zh: '其他', en: 'Other', icon: '✦', hintZh: '自定义步骤或素材说明', hintEn: 'A custom step or asset note' },
};

const SCRIPT_OCR_MODEL_LABEL = 'GPT-5.6 Luna';
const modelName = (model: VideoModelId) => model === 'minimax-h3' ? 'MiniMax H3' : model === 'seedance-2-5' ? 'Seedance 2.5' : model === 'seedance-2' ? 'Seedance 2.0' : model === 'kling-3' ? 'Kling 3.0' : model === 'veo-3.1-lite' ? 'Veo 3.1 Lite' : 'Auto';
const compatibleTemplateResolution = (model: VideoModelId, resolution: string) => model === 'minimax-h3'
  ? (resolution === '2K' ? '2K' : '768P')
  : model === 'kling-3'
    ? (['720p', '1080p', '4K'].includes(resolution) ? resolution : '720p')
    : model === 'veo-3.1-lite'
      ? (['720p', '1080p', '4K'].includes(resolution) ? resolution : '720p')
    : ['480p', '720p', '1080p'].includes(resolution) ? resolution : '720p';
const mergeGenerationContext = (previous: VideoGeneration | null, next: VideoGeneration) => {
  if (!previous || previous.id !== next.id) return next;
  return {
    ...next,
    generationSpec: next.generationSpec ?? previous.generationSpec ?? null,
    generationGroupId: next.generationGroupId ?? previous.generationGroupId ?? null,
    shotId: next.shotId ?? previous.shotId ?? null,
    shotOrder: next.shotOrder ?? previous.shotOrder ?? null,
    characterSetId: next.characterSetId ?? previous.characterSetId ?? null,
    sceneSetId: next.sceneSetId ?? previous.sceneSetId ?? null,
    continuityFromShotId: next.continuityFromShotId ?? previous.continuityFromShotId ?? null,
  };
};
const canvasNodeName = (nodeId: NodeId, zh: boolean) => ({
  source: zh ? '镜头边界' : 'Shot boundary',
  prompt: 'Motion Prompt',
  model: zh ? '模型设置' : 'Model settings',
  agent: zh ? 'Agent 导演' : 'Agent director',
  task: zh ? '视频生成' : 'Video generation',
  result: zh ? '视频结果' : 'Video result',
}[nodeId]);
const agentActionName = (action: CanvasAgentAction, zh: boolean) => {
  if (action.type === 'canvas.organize') return zh ? '整理画布' : 'Organize canvas';
  if (action.type === 'shot.create') return zh ? '创建镜头' : 'Create shot';
  if (action.type === 'shot.duplicate') return zh ? '复制镜头' : 'Duplicate shot';
  if (action.type === 'shot.delete') return zh ? '删除镜头' : 'Delete shot';
  return action.direction === 'up' ? (zh ? '镜头前移' : 'Move shot earlier') : (zh ? '镜头后移' : 'Move shot later');
};
const ASPECT_RATIO_OPTIONS: Array<{ value: '9:16' | '16:9' | '1:1'; label: string; className: string }> = [
  { value: '9:16', label: '9:16', className: 'is-portrait' },
  { value: '16:9', label: '16:9', className: 'is-landscape' },
  { value: '1:1', label: '1:1', className: 'is-square' },
];
const statusLabel = (status: VideoGeneration['status'], zh: boolean, errorCode?: string | null) => {
  if (errorCode === 'VIDEO_GENERATION_CANCELLED') return zh ? '已停止' : 'Stopped';
  return ({
  queued: zh ? '排队中' : 'Queued',
  processing: zh ? '生成中' : 'Processing',
  completed: zh ? '已完成' : 'Completed',
  failed: zh ? '失败' : 'Failed',
  }[status]);
};

function canvasEventLabel(event: CanvasEventSemantic, zh: boolean) {
  if (event.type === 'asset.bound') return zh ? '已绑定素材引用' : 'Asset reference bound';
  if (event.type === 'asset.invalidated') return zh ? '素材引用已失效' : 'Asset reference invalidated';
  if (event.type === 'agent.planned') return zh ? 'Agent 已完成规划' : 'Agent plan completed';
  const status = event.metadata.status;
  if (status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed') return statusLabel(status, zh);
  return zh ? '生成状态已更新' : 'Generation status updated';
}

function canvasReferenceRoleLabel(role: CanvasAssetRole, zh: boolean) {
  const labels: Record<CanvasAssetRole, string> = {
    generic: zh ? '素材' : 'Asset',
    start_frame: 'START',
    end_frame: 'END',
    reference: zh ? '参考' : 'Reference',
    output: zh ? '输出' : 'Output',
    character: zh ? '人物' : 'Character',
    motion: zh ? '动作' : 'Motion',
    style: zh ? '风格' : 'Style',
    scene: zh ? '场景' : 'Scene',
    prop: zh ? '道具' : 'Prop',
    script: zh ? '脚本' : 'Script',
    storyboard: zh ? '分镜' : 'Storyboard',
  };
  return labels[role];
}

const OMNI_REFERENCE_ROLE_VALUES: CanvasAssetRole[] = ['character', 'script', 'storyboard', 'motion', 'style', 'scene', 'prop', 'reference', 'start_frame'];

function failureStageLabel(stage: VideoGeneration['failureStage'], zh: boolean) {
  if (stage === 'provider') return zh ? '模型服务' : 'Provider';
  if (stage === 'media') return zh ? '媒体读取' : 'Media read';
  if (stage === 'storage') return zh ? '私有存储' : 'Private storage';
  if (stage === 'quality') return zh ? '质量门禁' : 'Quality gate';
  return zh ? '未知阶段' : 'Unknown stage';
}

function formatHistoryTime(value: string, zh: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return zh ? '时间未知' : 'Unknown time';
  return new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function historyShotLabel(item: VideoGeneration, zh: boolean) {
  if (Number.isInteger(item.shotOrder) && item.shotOrder! > 0) {
    return zh ? `镜头 ${String(item.shotOrder).padStart(2, '0')}` : `Shot ${String(item.shotOrder).padStart(2, '0')}`;
  }
  return item.shotId ? item.shotId : null;
}

function clientMessage(cause: unknown) {
  if (cause instanceof VideoGenerationClientError) return cause.message;
  return cause instanceof Error ? cause.message : '视频生成服务暂时不可用。';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fitViewportForFrame(
  frame: { x: number; y: number; width: number; height: number },
  bounds: { width: number; height: number },
): Viewport {
  const padding = 72;
  const availableWidth = Math.max(1, bounds.width - padding * 2);
  const availableHeight = Math.max(1, bounds.height - padding * 2);
  const scale = clamp(Math.min(availableWidth / frame.width, availableHeight / frame.height), 0.45, 1.2);
  return {
    scale,
    x: bounds.width / 2 - (frame.x + frame.width / 2) * scale,
    y: bounds.height / 2 - (frame.y + frame.height / 2) * scale,
  };
}

function uuidV4Fallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function frameReferenceIndex(frame: UploadedFrame, fallbackIndex: number) {
  return Number.isInteger(frame.referenceIndex) && frame.referenceIndex! >= 1 && frame.referenceIndex! <= 9
    ? frame.referenceIndex!
    : fallbackIndex + 1;
}

function referenceBindingForFrame(frame: UploadedFrame, index: number, bindings: CanvasSemantics['references']) {
  const mentionIndex = frameReferenceIndex(frame, index);
  return bindings.find(reference => reference.assetId === frame.assetId && reference.mentionId === `image:${mentionIndex}`) || {
    role: index === 0 ? 'start_frame' as const : 'reference' as const,
    strength: index === 0 ? 'strong' as const : 'weak' as const,
    priority: Math.max(10, 100 - index * 10),
    required: index === 0,
    constraints: [],
  };
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
  role,
  roleLabel,
  strength,
  zh,
  roleOptions,
  editable = false,
  onMention,
  onRemove,
  onRoleChange,
  onStrengthChange,
  onExtractText,
  extractingText = false,
  extractTextLabel,
  highlighted,
}: {
  frame: UploadedFrame;
  mentionLabel: string;
  loadingLabel: string;
  removeLabel: string;
  role: CanvasAssetRole;
  roleLabel: string;
  strength: 'strong' | 'weak';
  zh: boolean;
  roleOptions?: Array<{ value: CanvasAssetRole; label: string }>;
  editable?: boolean;
  onMention: () => void;
  onRemove: () => void;
  onRoleChange?: (role: CanvasAssetRole) => void;
  onStrengthChange?: () => void;
  onExtractText?: () => void;
  extractingText?: boolean;
  extractTextLabel?: string;
  highlighted?: boolean;
}) {
  return <div className={'canvas-omni-reference ' + (highlighted ? 'is-highlighted' : '')} data-highlighted={highlighted ? 'true' : undefined}>
    {frame.previewUrl ? <img src={frame.previewUrl} alt={frame.name} /> : <div className="canvas-media-loading">{loadingLabel}</div>}
    {editable && roleOptions && onRoleChange ? <div className="canvas-reference-controls" onPointerDown={event => event.stopPropagation()}>
      <select value={role} aria-label={`${mentionLabel} ${roleLabel}`} onChange={event => onRoleChange(event.target.value as CanvasAssetRole)}>
        {roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {onStrengthChange && <button type="button" className={'canvas-reference-strength ' + strength} aria-pressed={strength === 'strong'} aria-label={strength === 'strong' ? `${mentionLabel} ${roleLabel}: ${zh ? '强约束' : 'strong constraint'}` : `${mentionLabel} ${roleLabel}: ${zh ? '弱参考' : 'weak reference'}`} title={strength === 'strong' ? (zh ? '强约束：尽量保持该素材特征' : 'Strong constraint: preserve this asset’s features') : (zh ? '弱参考：仅提供方向，不强制复刻' : 'Weak reference: guide the direction without forcing a match')} onClick={onStrengthChange}>{strength === 'strong' ? (zh ? '强' : 'S') : (zh ? '弱' : 'W')}</button>}
      {onExtractText && (role === 'script' || role === 'storyboard') && <button type="button" className="canvas-reference-ocr" disabled={extractingText} onClick={onExtractText} aria-label={extractTextLabel}>{extractingText ? (zh ? '识别中…' : 'Reading…') : (zh ? '提取文字' : 'Extract text')}</button>}
    </div> : <span className="canvas-reference-role-pill">{roleLabel}</span>}
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
  const [routingStrategy, setRoutingStrategy] = useState<ModelRoutingStrategy>('BALANCED');
  const [duration, setDuration] = useState('5s');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [resolution, setResolution] = useState('720p');
  const [shot, setShot] = useState(1);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('start-end');
  const [startFrame, setStartFrame] = useState<UploadedFrame | null>(null);
  const [endFrame, setEndFrame] = useState<UploadedFrame | null>(null);
  const [referenceFrames, setReferenceFrames] = useState<UploadedFrame[]>([]);
  const [uploading, setUploading] = useState<'start' | 'end' | 'reference' | null>(null);
  const [scriptOcr, setScriptOcr] = useState<ScriptOcrState>({ assetId: null, status: 'idle', text: '', result: null, error: '' });
  const [generation, setGeneration] = useState<VideoGeneration | null>(null);
  const [agentPlan, setAgentPlan] = useState<VideoGenerationPlan | null>(null);
  const [restoredGenerationId, setRestoredGenerationId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [clockNow, setClockNow] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<VideoGeneration[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareModels, setCompareModels] = useState<Array<Exclude<VideoModelId, 'auto'>>>([]);
  const [comparePreviewUrls, setComparePreviewUrls] = useState<Record<string, string>>({});
  const [comparePreviewLoading, setComparePreviewLoading] = useState(false);
  const [comparePreviewError, setComparePreviewError] = useState('');
  const [nodePaletteOpen, setNodePaletteOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [composerCollapsed, setComposerCollapsed] = useState(false);
  const [customLayoutMode, setCustomLayoutMode] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCustomNodeId, setSelectedCustomNodeId] = useState<string | null>(null);
  const [customNodes, setCustomNodes] = useState<CanvasCustomNode[]>([]);
  const [customEdges, setCustomEdges] = useState<CanvasCustomEdge[]>([]);
  const [customNodePreviewUrls, setCustomNodePreviewUrls] = useState<Record<string, string>>({});
  const [nodePaletteParentId, setNodePaletteParentId] = useState<string | null>(null);
  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [canvasSemantics, setCanvasSemantics] = useState<CanvasSemantics>(() => createCanvasSemantics(1));
  const [shotSnapshots, setShotSnapshots] = useState<ShotSnapshot[]>([]);
  const [appliedAgentActionIds, setAppliedAgentActionIds] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const paletteImageInputRef = useRef<HTMLInputElement | null>(null);
  const promptReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ id: NodeId; clientX: number; clientY: number; origin: Point } | null>(null);
  const customDragRef = useRef<{ id: string; clientX: number; clientY: number; origin: Point } | null>(null);
  const customNodePreviewUrlsRef = useRef<Record<string, string>>({});
  const shotDragRef = useRef<{ clientX: number; clientY: number; origin: NodePositions; customOrigin: CanvasCustomNode[] } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; origin: Point } | null>(null);
  const referenceFramesRef = useRef<UploadedFrame[]>([]);
  // One UUID groups generations created in this canvas session. It is sent as
  // lineage metadata only; the server still validates it and never uses it for
  // routing or billing. A fresh browser session intentionally starts a fresh
  // generation group.
  const generationGroupIdRef = useRef<string | null>(null);
  const generationContextRef = useRef<VideoGeneration | null>(null);
  const historyRestoreRequestRef = useRef(0);
  const fullscreenFallbackRef = useRef(false);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateSize = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    const frame = window.requestAnimationFrame(updateSize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSize);
    observer?.observe(element);
    window.addEventListener('resize', updateSize);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isCanvasFullscreen]);

  const setActiveGeneration = useCallback((next: VideoGeneration | null) => {
    const resolved = next ? mergeGenerationContext(generationContextRef.current, next) : null;
    generationContextRef.current = resolved;
    setGeneration(resolved);
    return resolved;
  }, []);

  const captureCurrentShot = () : ShotSnapshot => ({
    shot,
    nodes: { ...nodes },
    prompt,
    model,
    routingStrategy,
    duration,
    aspectRatio,
    resolution,
    startFrame: cloneFrame(startFrame),
    endFrame: cloneFrame(endFrame),
    referenceMode,
    referenceFrames: referenceFrames.map(frame => ({ ...frame })),
    generation,
    restoredGenerationId,
    videoUrl,
    agentPlan,
    semantics: canvasSemantics,
    scriptOcr: scriptOcrDraftFromState(scriptOcr),
    customNodes: customNodes.map(node => ({ ...node })),
    customEdges: customEdges.map(edge => ({ ...edge })),
  });

  const applyShotSnapshot = (snapshot: ShotSnapshot) => {
    setNodes({ ...snapshot.nodes });
    setPrompt(snapshot.prompt);
    setModel(snapshot.model);
    setRoutingStrategy(snapshot.routingStrategy || 'BALANCED');
    setDuration(normalizeVideoDuration(snapshot.model, snapshot.duration));
    setAspectRatio(snapshot.aspectRatio);
    setResolution(snapshot.resolution);
    setStartFrame(cloneFrame(snapshot.startFrame));
    setEndFrame(cloneFrame(snapshot.endFrame));
    setReferenceMode(snapshot.referenceMode);
    setReferenceFrames(snapshot.referenceFrames.map(frame => ({ ...frame })));
    setScriptOcr(snapshot.scriptOcr
      ? { assetId: snapshot.scriptOcr.assetId, status: 'ready', text: snapshot.scriptOcr.text, result: null, error: '' }
      : { assetId: null, status: 'idle', text: '', result: null, error: '' });
    setActiveGeneration(snapshot.generation);
    setCancelling(false);
    setRestoredGenerationId(snapshot.restoredGenerationId);
    setVideoUrl(snapshot.videoUrl);
    setAgentPlan(snapshot.agentPlan);
    setCanvasSemantics(snapshot.semantics);
    setCustomNodes((snapshot.customNodes || []).map(node => ({ ...node })));
    setCustomEdges((snapshot.customEdges || []).map(edge => ({ ...edge })));
    setShot(snapshot.shot);
    setAppliedAgentActionIds([]);
    setSelectedNodeId(null);
    setSelectedCustomNodeId(null);
    setHighlightedAssetId(null);
    setHistoryOpen(false);
    setCompareOpen(false);
    setNodePaletteOpen(false);
    setNodePaletteParentId(null);
    setTemplateOpen(false);
    setMinimapOpen(false);
  };

  const routingRegistry = useMemo(() => registryWithApiModels(models), [models]);
  const shotAnalysis = useMemo(() => analyzeShot({
    prompt,
    startFrame: referenceMode === 'start-end' ? Boolean(startFrame) : false,
    endFrame: referenceMode === 'start-end' ? Boolean(endFrame) : false,
    referenceImages: referenceMode === 'omni' ? referenceFrames.length : 0,
    referenceMode,
    duration: Number.parseInt(duration, 10),
    resolution,
    aspectRatio,
    priority: routingStrategy,
  }), [aspectRatio, duration, endFrame, prompt, referenceFrames.length, referenceMode, resolution, routingStrategy, startFrame]);
  const routingResult = useMemo(() => routeShot(shotAnalysis, routingStrategy, routingRegistry), [routingRegistry, routingStrategy, shotAnalysis]);
  const effectiveModel = model === 'auto' ? routingResult.recommendedModel : model;
  const selectedModel = useMemo(() => models.find(item => item.id === effectiveModel) || null, [effectiveModel, models]);
  const estimatedCredits = useMemo(() => estimateVideoCredits(selectedModel, duration), [duration, selectedModel]);
  const settingsModel = effectiveModel || 'seedance-2';
  const resolutionOptions = settingsModel === 'minimax-h3' ? ['768P', '2K'] : ['kling-3', 'veo-3.1-lite'].includes(settingsModel) ? ['720p', '1080p', '4K'] : ['480p', '720p', '1080p'];
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
  const hasReferenceInput = referenceMode === 'text' || (referenceMode === 'omni' ? referenceFrames.length > 0 : Boolean(startFrame));
  const assetMentionValidation = useMemo(() => validateCanvasAssetMentions(canvasSemantics, prompt), [canvasSemantics, prompt]);
  const activeReferenceBindings = useMemo(() => canvasSemantics.references
    .filter(reference => reference.shotId === canvasSemantics.shot.id)
    .slice(-9), [canvasSemantics.references, canvasSemantics.shot.id]);
  const scriptReferenceFrames = useMemo(() => referenceFrames.flatMap((frame, index) => {
    const binding = referenceBindingForFrame(frame, index, activeReferenceBindings);
    return binding.role === 'script' || binding.role === 'storyboard' ? [{ frame, index, binding }] : [];
  }), [activeReferenceBindings, referenceFrames]);
  const omniReferenceRoleOptions = useMemo(() => OMNI_REFERENCE_ROLE_VALUES.map(value => ({
    value,
    label: canvasReferenceRoleLabel(value, zh),
  })), [zh]);
  const mentionCandidates = useMemo<PromptMentionCandidate[]>(() => {
    const source = referenceMode === 'omni'
      ? referenceFrames.map((frame, index) => ({ frame, index, role: referenceBindingForFrame(frame, index, activeReferenceBindings).role }))
      : [
        ...(startFrame ? [{ frame: startFrame, index: 0, role: 'start_frame' as const }] : []),
        ...(endFrame ? [{ frame: endFrame, index: 1, role: 'end_frame' as const }] : []),
      ];
    return source.map(({ frame, index, role }) => {
      const mentionIndex = frameReferenceIndex(frame, index);
      return {
        frame,
        index,
        token: `@${zh ? '图片' : 'image'}${mentionIndex}`,
        role,
      };
    });
  }, [activeReferenceBindings, endFrame, referenceFrames, referenceMode, startFrame, zh]);
  const filteredMentionCandidates = useMemo(() => {
    const query = mentionQuery.trim().toLocaleLowerCase(zh ? 'zh-CN' : 'en-US');
    if (!mentionMenuOpen || mentionStart === null) return [];
    return mentionCandidates.filter(candidate => {
      if (!query) return true;
      const role = canvasReferenceRoleLabel(candidate.role, zh).toLocaleLowerCase(zh ? 'zh-CN' : 'en-US');
      return candidate.token.toLocaleLowerCase(zh ? 'zh-CN' : 'en-US').includes(query)
        || candidate.frame.name.toLocaleLowerCase(zh ? 'zh-CN' : 'en-US').includes(query)
        || role.includes(query);
    }).slice(0, 9);
  }, [mentionCandidates, mentionMenuOpen, mentionQuery, mentionStart, zh]);
  const promptMentionChips = useMemo(() => assetMentionValidation.mentions.map(mention => {
    const candidate = mentionCandidates.find(item => frameReferenceIndex(item.frame, item.index) === mention.index);
    const binding = assetMentionValidation.bindings.find(item => item.mentionId === mention.mentionId);
    return {
      ...mention,
      frame: candidate?.frame || null,
      role: binding?.role || candidate?.role || 'reference',
      status: binding?.status || (candidate ? 'valid' : 'unbound'),
    };
  }), [assetMentionValidation.bindings, assetMentionValidation.mentions, mentionCandidates]);
  const recentCanvasEvents = useMemo(() => canvasSemantics.events
    .filter(event => event.shotId === canvasSemantics.shot.id)
    .slice(-5)
    .reverse(), [canvasSemantics.events, canvasSemantics.shot.id]);
  const effectiveDefinition = effectiveModel ? routingRegistry.find(item => item.id === effectiveModel) : null;
  const referenceModeSupported = Boolean(effectiveDefinition && (referenceMode === 'text'
    ? effectiveDefinition.capabilities.textToVideo
    : effectiveDefinition.capabilities.imageToVideo && effectiveDefinition.capabilities.startFrame
      && (referenceMode !== 'omni' || effectiveDefinition.capabilities.omniReference)));
  const preflight = useMemo(() => preflightVideoGeneration({
    language: zh ? 'zh' : 'en',
    model: effectiveModel || 'auto',
    modelReady: Boolean(selectedModel?.enabled),
    prompt,
    referenceMode,
    startFrame,
    endFrame,
    referenceFrames,
    duration,
    aspectRatio,
    resolution,
    unboundMentionCount: assetMentionValidation.unbound.length,
    invalidMentionCount: assetMentionValidation.invalid.length,
  }), [aspectRatio, assetMentionValidation.invalid.length, assetMentionValidation.unbound.length, duration, effectiveModel, endFrame, prompt, referenceFrames, referenceMode, resolution, selectedModel?.enabled, startFrame, zh]);
  const generationInFlight = generation?.status === 'queued' || generation?.status === 'processing';
  const canGenerate = Boolean(effectiveAccess === 'ready' && effectiveModel && hasReferenceInput && referenceModeSupported && preflight.ok && !submitting && !cancelling && !uploading && !generationInFlight);
  const compareModelIsEligible = (candidate: Exclude<VideoModelId, 'auto'>) => {
    const definition = routingRegistry.find(item => item.id === candidate);
    if (!definition || definition.adapterStatus !== 'ready') return false;
    if (referenceMode === 'text' && !definition.capabilities.textToVideo) return false;
    if (referenceMode !== 'text' && (!definition.capabilities.imageToVideo || !definition.capabilities.startFrame)) return false;
    if (referenceMode === 'omni' && !definition.capabilities.omniReference) return false;
    if (!definition.resolutions.includes(resolution)) return false;
    const seconds = Number.parseInt(duration, 10);
    return seconds >= definition.duration.minSeconds && seconds <= definition.duration.maxSeconds;
  };
  const canCompare = Boolean(canGenerate && compareModels.length >= 2 && compareModels.length <= 3 && compareModels.every(compareModelIsEligible));
  const shotActionsDisabled = submitting || cancelling || Boolean(uploading) || generationInFlight;
  const agentPlanBlockedReason = !prompt.trim()
    ? (zh ? '先在下方填写 Motion Prompt' : 'Add a Motion Prompt below first')
    : '';
  const generationBlockedReason = (() => {
    if (submitting) return zh ? '正在提交任务' : 'Submitting the task';
    if (uploading) return zh ? '参考图正在上传' : 'A reference image is uploading';
    if (!hasReferenceInput) return zh ? '先加入至少 1 张参考图' : 'Add at least one reference image';
    if (!prompt.trim()) return zh ? '填写 Motion Prompt 后即可生成' : 'Add a Motion Prompt to generate';
    if (assetMentionValidation.unbound.length) return zh ? `有 ${assetMentionValidation.unbound.length} 个素材引用尚未绑定` : `${assetMentionValidation.unbound.length} asset mention${assetMentionValidation.unbound.length > 1 ? 's are' : ' is'} not bound`;
    if (assetMentionValidation.invalid.length) return zh ? `有 ${assetMentionValidation.invalid.length} 个素材引用已失效，请重新绑定` : `${assetMentionValidation.invalid.length} asset mention${assetMentionValidation.invalid.length > 1 ? 's are' : ' is'} invalid; rebind it before generating`;
    if (!referenceModeSupported) return zh ? '当前模型不支持这个参考模式' : 'This model does not support the selected reference mode';
    if (!selectedModel?.enabled) return zh ? '选择一个已就绪的模型' : 'Choose a model that is ready';
    if (preflight.errors.length) return preflight.errors[0].message;
    return '';
  })();
  const progress = generation?.progress || 0;
  const generationId = generation?.id;
  const generationStatus = generation?.status;
  const generationTimeEstimate = useMemo(() => {
    if (!generation) return null;
    return estimateVideoGenerationTime({
      model: generation.model,
      duration: generation.duration,
      referenceCount: referenceMode === 'text' ? 0 : referenceMode === 'omni' ? referenceFrames.length : 1 + (endFrame ? 1 : 0),
      resolution: generation.resolution,
      status: generation.status,
      progress: generation.progress,
      startedAt: generation.startedAt,
      createdAt: generation.createdAt,
      completedAt: generation.completedAt,
      now: clockNow || undefined,
    });
  }, [clockNow, endFrame, generation, referenceFrames.length, referenceMode]);
  const generationTimeCopy = useMemo(() => {
    if (!generation || !generationTimeEstimate) return null;
    const range = formatVideoGenerationTimeRange(generationTimeEstimate.minSeconds, generationTimeEstimate.maxSeconds, zh);
    if (generation.status === 'queued') {
      return {
        primary: zh ? `预计总耗时约 ${range}` : `Estimated total ${range}`,
        secondary: zh ? '排队后会自动更新' : 'Updates once rendering starts',
        mode: 'range',
      };
    }
    if (generation.status === 'processing') {
      return {
        primary: generationTimeEstimate.remainingSeconds !== null
          ? (zh ? `预计还需约 ${formatVideoGenerationTime(generationTimeEstimate.remainingSeconds, zh)}` : `About ${formatVideoGenerationTime(generationTimeEstimate.remainingSeconds, zh)} left`)
          : (zh ? `预计总耗时约 ${range}` : `Estimated total ${range}`),
        secondary: generationTimeEstimate.elapsedSeconds > 0
          ? (zh ? `已耗时 ${formatVideoGenerationTime(generationTimeEstimate.elapsedSeconds, zh)}` : `${formatVideoGenerationTime(generationTimeEstimate.elapsedSeconds, zh)} elapsed`)
          : (zh ? '开始后会更新' : 'Updates once rendering starts'),
        mode: 'remaining',
      };
    }
    if (generation.status === 'completed') {
      return {
        primary: generationTimeEstimate.actualSeconds !== null
          ? (zh ? `实际用时 ${formatVideoGenerationTime(generationTimeEstimate.actualSeconds, zh)}` : `Completed in ${formatVideoGenerationTime(generationTimeEstimate.actualSeconds, zh)}`)
          : (zh ? '生成已完成' : 'Generation complete'),
        secondary: '',
        mode: 'complete',
      };
    }
    return {
      primary: generation.errorCode === 'VIDEO_GENERATION_CANCELLED'
        ? (zh ? '可修改后重试' : 'Edit and retry')
        : (zh ? '可再次生成' : 'Ready to retry'),
      secondary: '',
      mode: 'stopped',
    };
  }, [generation, generationTimeEstimate, zh]);
  const currentVersion = useMemo(() => canvasVersionForGeneration(canvasSemantics, generation?.id), [canvasSemantics, generation?.id]);
  const shotVersions = useMemo(() => canvasSemantics.versions
    .filter(version => version.shotId === canvasSemantics.shot.id)
    .sort((left, right) => left.number - right.number)
    .map(version => ({ version, generation: history.find(item => item.id === version.generationId) || null })), [canvasSemantics, history]);
  const alternateModel: Exclude<VideoModelId, 'auto'> = model === 'minimax-h3' || model === 'kling-3' ? 'seedance-2-5' : 'minimax-h3';
  const alternateModelDetails = useMemo(() => models.find(item => item.id === alternateModel) || null, [alternateModel, models]);
  const shotSnapshotsByNumber = useMemo(() => new Map(shotSnapshots.map(snapshot => [snapshot.shot, snapshot])), [shotSnapshots]);
  const shotRailItems = useMemo(() => {
    const current = { shot, order: canvasSemantics.shot.order || shot, status: canvasSemantics.shot.status };
    const byNumber = new Map(shotSnapshots.map(snapshot => [snapshot.shot, {
      shot: snapshot.shot,
      order: snapshot.semantics.shot.order || snapshot.shot,
      status: snapshot.semantics.shot.status,
    }]));
    byNumber.set(shot, current);
    return Array.from(byNumber.values()).sort((left, right) => left.order - right.order || left.shot - right.shot);
  }, [canvasSemantics.shot.order, canvasSemantics.shot.status, shot, shotSnapshots]);
  const nextShotNumber = () => Math.max(shot, ...shotSnapshots.map(snapshot => snapshot.shot), 0) + 1;

  const currentShotRailIndex = shotRailItems.findIndex(item => item.shot === shot);
  const canMoveCurrentShotUp = currentShotRailIndex > 0;
  const canMoveCurrentShotDown = currentShotRailIndex >= 0 && currentShotRailIndex < shotRailItems.length - 1;

  const switchShot = (targetShot: number) => {
    if (targetShot === shot) return;
    const target = shotSnapshotsByNumber.get(targetShot);
    if (!target) return;
    setShotSnapshots(previous => upsertShotSnapshot(previous, captureCurrentShot()));
    applyShotSnapshot(target);
  };

  const reorderCurrentShot = (direction: 'up' | 'down') => {
    if ((direction === 'up' && !canMoveCurrentShotUp) || (direction === 'down' && !canMoveCurrentShotDown)) return false;
    const currentSnapshot = captureCurrentShot();
    const reordered = reorderShotSnapshots(upsertShotSnapshot(shotSnapshots, currentSnapshot), shot, direction);
    const active = reordered.find(snapshot => snapshot.shot === shot);
    if (!active) return false;
    setShotSnapshots(reordered);
    setCanvasSemantics(active.semantics);
    notify(direction === 'up'
      ? (zh ? `镜头 ${String(shot).padStart(2, '0')} 已前移。` : `Shot ${String(shot).padStart(2, '0')} moved earlier.`)
      : (zh ? `镜头 ${String(shot).padStart(2, '0')} 已后移。` : `Shot ${String(shot).padStart(2, '0')} moved later.`));
    return true;
  };

  const deleteCurrentShot = () => {
    if (shotActionsDisabled) return false;
    const currentSnapshot = captureCurrentShot();
    const allSnapshots = upsertShotSnapshot(shotSnapshots, currentSnapshot);
    if (allSnapshots.length <= 1) {
      notify(zh ? '至少保留一个镜头。' : 'Keep at least one shot in the canvas.');
      return false;
    }
    const confirmation = zh
      ? `删除镜头 ${String(shot).padStart(2, '0')}？生成历史仍会保留，但这个镜头会从当前画布移除。`
      : `Delete shot ${String(shot).padStart(2, '0')}? Generation history stays available, but this shot will be removed from the canvas.`;
    if (typeof window !== 'undefined' && !window.confirm(confirmation)) return false;
    const ordered = sortShotSnapshots(allSnapshots);
    const index = ordered.findIndex(snapshot => snapshot.shot === shot);
    const fallback = ordered[index > 0 ? index - 1 : 1];
    const remaining = removeShotSnapshot(ordered, shot);
    if (!fallback) return false;
    setShotSnapshots(remaining);
    applyShotSnapshot(fallback);
    notify(zh ? `已删除镜头 ${String(shot).padStart(2, '0')}。` : `Shot ${String(shot).padStart(2, '0')} deleted.`);
    return true;
  };

  const rememberGeneration = useCallback((next: VideoGeneration) => {
    setHistory(previous => {
      const merged = [next, ...previous.filter(item => item.id !== next.id)];
      return merged.toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    });
    setCanvasSemantics(previous => recordCanvasEvent(recordCanvasGeneration(previous, next), {
      id: `generation-status-${next.id}-${next.status}`,
      type: 'generation.status',
      actor: 'system',
      message: next.status,
      metadata: {
        generationId: next.id,
        status: next.status,
        progress: Math.round(Number(next.progress) || 0),
      },
    }));
  }, []);

  const patchSemanticNode = useCallback((nodeId: NodeId, patch: Parameters<typeof patchCanvasNode>[2]) => {
    setCanvasSemantics(previous => patchCanvasNode(previous, nodeId, patch));
  }, []);

  const rememberImageAsset = useCallback((frame: UploadedFrame, role: CanvasAssetRole) => {
    setCanvasSemantics(previous => registerCanvasAsset(previous, {
      assetId: frame.assetId,
      kind: 'image',
      role,
      shotId: previous.shot.id,
      name: frame.name,
      width: frame.width,
      height: frame.height,
    }));
  }, []);

  const retireAsset = useCallback((assetId: string | null | undefined) => {
    if (!assetId) return;
    setCanvasSemantics(previous => recordCanvasEvent(markCanvasAssetUnavailable(previous, assetId), {
      id: `asset-invalidated-${assetId}`,
      type: 'asset.invalidated',
      actor: 'user',
      message: 'reference-invalidated',
      metadata: { assetId },
    }));
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
    if (next) setCompareOpen(false);
    if (next) setNodePaletteOpen(false);
    if (next) setTemplateOpen(false);
    if (next) setMinimapOpen(false);
    if (next && history.length === 0 && !historyLoading) void loadHistoryPage();
  };

  const toggleCompare = () => {
    const next = !compareOpen;
    setCompareOpen(next);
    if (next) setHistoryOpen(false);
    if (next) setNodePaletteOpen(false);
    if (next) setTemplateOpen(false);
    if (next) setMinimapOpen(false);
    if (next && history.length === 0 && !historyLoading) void loadHistoryPage();
  };

  useEffect(() => {
    if (!compareOpen) return;
    const pending = shotVersions
      .map(({ generation: item }) => item)
      .filter((item): item is VideoGeneration => Boolean(item?.videoAssetId && item.status === 'completed' && !comparePreviewUrls[item.id]));
    if (!pending.length) return;
    let cancelled = false;
    const load = async () => {
      // Yield once before updating local state so opening the panel does not
      // synchronously cascade another render from inside this effect.
      await Promise.resolve();
      if (cancelled) return;
      setComparePreviewLoading(true);
      setComparePreviewError('');
      const settled = await Promise.allSettled(pending.map(async item => [item.id, await loadVideoAssetUrl(item.videoAssetId!)] as const));
      if (cancelled) return;
      const next: Record<string, string> = {};
      let failed = false;
      settled.forEach(result => {
        if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
        else failed = true;
      });
      if (Object.keys(next).length) setComparePreviewUrls(previous => ({ ...previous, ...next }));
      if (failed) setComparePreviewError(zh ? '部分版本视频暂时无法读取。' : 'Some version videos could not be loaded.');
      setComparePreviewLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [compareOpen, comparePreviewUrls, shotVersions, zh]);

  const markBestTake = (generationId: string) => {
    const candidate = history.find(item => item.id === generationId);
    if (candidate && candidate.status !== 'completed') {
      notify(zh ? '只有已完成的版本可以设为最佳。' : 'Only completed versions can be selected as the Best Take.');
      return;
    }
    setCanvasSemantics(previous => selectCanvasBestTake(previous, generationId));
    notify(zh ? '已将该版本标记为最佳镜头。' : 'This version is now the Best Take.');
  };

  const selectGenerationAsCurrent = async (item: VideoGeneration) => {
    if (item.status !== 'completed') {
      notify(zh ? '只有已完成的候选结果可以采用。' : 'Only completed candidates can be selected.');
      return;
    }
    setCanvasSemantics(previous => selectCanvasBestTake(previous, item.id));
    await restoreHistoryItem(item);
    notify(zh ? '已采用该候选结果，原有版本仍保留。' : 'This candidate is now active; the other versions remain available.');
  };

  const restoreHistoryItem = async (item: VideoGeneration) => {
    const requestId = ++historyRestoreRequestRef.current;
    const activeItem = setActiveGeneration(item);
    setCancelling(false);
    if (activeItem) rememberGeneration(activeItem);
    setRestoredGenerationId(item.id);
    setPrompt(item.prompt);
    setModel(item.model);
    setDuration(normalizeVideoDuration(item.model, item.duration));
    setAspectRatio(item.aspectRatio);
    setResolution(item.resolution);
    setVideoUrl('');
    setHistoryOpen(false);
    setCompareOpen(false);
    const spec = item.generationSpec;
    const referenceMode = spec?.referenceMode || (spec?.references && spec.references.length > 2 ? 'omni' : 'start-end');
    const referenceIds = referenceMode === 'omni'
      ? (spec?.references || []).map(reference => reference.assetId).filter(Boolean).slice(0, 9)
      : [];
    const startId = item.startImageAssetId || spec?.references?.find(reference => reference.role === 'start_frame')?.assetId || null;
    const endId = item.endImageAssetId || spec?.references?.find(reference => reference.role === 'end_frame')?.assetId || null;
    try {
      const frameFromAsset = async (assetId: string, name: string, referenceIndex?: number): Promise<UploadedFrame | null> => {
        const asset = await loadVideoAsset(assetId);
        if (asset.kind !== 'input-image' && asset.kind !== 'output-frame') return null;
        return {
          assetId,
          name,
          previewUrl: asset.url,
          width: asset.width || 0,
          height: asset.height || 0,
          ...(referenceIndex ? { referenceIndex } : {}),
        };
      };
      const [start, end, references] = await Promise.all([
        startId ? frameFromAsset(startId, zh ? '历史 START' : 'History START') : Promise.resolve(null),
        referenceMode === 'start-end' && endId ? frameFromAsset(endId, zh ? '历史 END' : 'History END') : Promise.resolve(null),
        referenceMode === 'omni'
          ? Promise.all(referenceIds.map((assetId, index) => frameFromAsset(assetId, `${zh ? '参考图' : 'Reference'} ${index + 1}`, index + 1)))
          : Promise.resolve([] as Array<UploadedFrame | null>),
      ]);
      if (requestId !== historyRestoreRequestRef.current) return;
      setReferenceMode(referenceMode);
      setStartFrame(referenceMode === 'start-end' ? start : null);
      setEndFrame(referenceMode === 'start-end' ? end : null);
      const validReferences = references.filter((frame): frame is UploadedFrame => Boolean(frame));
      setReferenceFrames(referenceMode === 'omni' ? validReferences : []);
      setCanvasSemantics(previous => {
        let next = previous;
        const frames = [
          ...(referenceMode === 'start-end' && start ? [{ frame: start, role: 'start_frame' as const }] : []),
          ...(referenceMode === 'start-end' && end ? [{ frame: end, role: 'end_frame' as const }] : []),
          ...(referenceMode === 'omni' ? validReferences.map(frame => ({ frame, role: 'reference' as const })) : []),
        ];
        frames.forEach(({ frame, role }, index) => {
          next = registerCanvasAsset(next, {
            assetId: frame.assetId,
            kind: 'image',
            role,
            shotId: next.shot.id,
            name: frame.name,
            width: frame.width,
            height: frame.height,
            generationId: item.id,
          });
          next = bindCanvasAssetReference(next, {
            token: `@${zh ? '图片' : 'image'}${index + 1}`,
            assetId: frame.assetId,
            role,
            priority: Math.max(10, 100 - index * 10),
            strength: index === 0 || role !== 'reference' ? 'strong' : 'weak',
            required: index === 0,
          });
        });
        return patchCanvasNode(next, 'source', { role: 'reference', assetId: (start || validReferences[0])?.assetId || null, status: 'draft' });
      });
      notify(zh ? '历史任务已载入，参数和可用参考图已恢复；不会自动重新生成。' : 'History loaded with parameters and available references; no new generation was submitted.');
    } catch (cause) {
      if (requestId === historyRestoreRequestRef.current) {
        notify(zh ? '历史参数已载入，但部分参考图无法读取，请重新绑定后再生成。' : 'History parameters loaded, but some references could not be read. Rebind them before generating.');
        setError(clientMessage(cause));
      }
    }
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
    if (!historyOpen && !nodePaletteOpen && !compareOpen && !templateOpen && !minimapOpen) return;
    const closePanels = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setHistoryOpen(false);
      setNodePaletteOpen(false);
      setCompareOpen(false);
      setTemplateOpen(false);
      setMinimapOpen(false);
    };
    window.addEventListener('keydown', closePanels);
    return () => window.removeEventListener('keydown', closePanels);
  }, [compareOpen, historyOpen, minimapOpen, nodePaletteOpen, templateOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedCanvas;
        if (saved.version === 1 || saved.version === 2 || saved.version === 3 || saved.version === 4 || saved.version === 5) {
          // Hydration intentionally mirrors an external localStorage snapshot
          // after mount; this is the one synchronous state sync in this effect.
          // v3 reserves a dedicated composer row, so older layouts need the
          // new compact positions once instead of restoring covered nodes.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setNodes(saved.version >= 3 ? restoreNodePositions(saved.nodes) : INITIAL_NODES);
          setPrompt(saved.prompt || '');
          const restoredReferenceMode = saved.referenceMode || 'start-end';
          const restoredModel = saved.model || 'seedance-2';
          setModel(restoredModel);
          setRoutingStrategy(saved.routingStrategy || 'BALANCED');
          setDuration(normalizeVideoDuration(restoredModel, saved.duration || '5s'));
          setAspectRatio(saved.aspectRatio || '9:16');
          setResolution(saved.resolution || '720p');
          setShot(saved.activeShot || saved.shot || 1);
          if (saved.startFrame) setStartFrame({ ...saved.startFrame, previewUrl: '' });
          if (saved.endFrame) setEndFrame({ ...saved.endFrame, previewUrl: '' });
          setReferenceMode(restoredReferenceMode);
          setReferenceFrames((saved.referenceFrames || []).slice(0, 9).map(frame => ({ ...frame, previewUrl: '' })));
          setRestoredGenerationId(saved.generationId || null);
          if (saved.generationGroupId) generationGroupIdRef.current = saved.generationGroupId;
          setCanvasSemantics(normalizeCanvasSemantics(saved.semantics, saved.shot || 1));
          const restoredCustomNodes = normalizeCustomNodes(saved.customNodes);
          setCustomNodes(restoredCustomNodes);
          setCustomEdges(normalizeCustomEdges(saved.customEdges, restoredCustomNodes));
          const restoredScriptOcr = restoreScriptOcr(saved.scriptOcr);
          if (restoredScriptOcr) setScriptOcr({ assetId: restoredScriptOcr.assetId, status: 'ready', text: restoredScriptOcr.text, result: null, error: '' });
          if (Array.isArray(saved.shots)) setShotSnapshots(saved.shots.slice(0, 24).map(savedShot => restoreSavedShot(savedShot, restoreNodePositions)));
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
    const currentSnapshot: ShotSnapshot = {
      shot,
      nodes: { ...nodes },
      prompt,
      model,
      routingStrategy,
      duration,
      aspectRatio,
      resolution,
      startFrame: cloneFrame(startFrame),
      endFrame: cloneFrame(endFrame),
      referenceMode,
      referenceFrames: referenceFrames.map(frame => ({ ...frame })),
      generation,
      restoredGenerationId,
      videoUrl,
      agentPlan,
      semantics: canvasSemantics,
      scriptOcr: scriptOcrDraftFromState(scriptOcr),
      customNodes: customNodes.map(node => ({ ...node })),
      customEdges: customEdges.map(edge => ({ ...edge })),
    };
    const savedShots = limitShotSnapshots(upsertShotSnapshot(shotSnapshots, currentSnapshot), shot, 24)
      .map(serializeShotSnapshot);
    const saved: SavedCanvas = {
      version: 5,
      nodes,
      prompt,
      model,
      routingStrategy,
      duration,
      aspectRatio,
      resolution,
      shot,
      startFrame: stripFrame(startFrame),
      endFrame: stripFrame(endFrame),
      referenceMode,
      referenceFrames: referenceFrames.map(stripFrame).filter((frame): frame is PersistedFrame => Boolean(frame)),
      generationId: generation?.id || restoredGenerationId,
      generationGroupId: generationGroupIdRef.current,
      semantics: canvasSemantics,
      activeShot: shot,
      shots: savedShots,
      scriptOcr: scriptOcrDraftFromState(scriptOcr),
      customNodes: customNodes.map(node => ({ ...node })),
      customEdges: customEdges.map(edge => ({ ...edge })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [agentPlan, aspectRatio, canvasSemantics, customEdges, customNodes, duration, endFrame, generation, hydrated, model, nodes, prompt, referenceFrames, referenceMode, resolution, restoredGenerationId, routingStrategy, scriptOcr, shot, shotSnapshots, startFrame, videoUrl]);

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
        if (currentModel === 'auto') return currentModel;
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
            // A user may switch shots while this refresh is in flight. Do not
            // let a late response for the previous history item replace the
            // currently selected task.
            if (generationContextRef.current && generationContextRef.current.id !== restoredGenerationId) return;
            const activeNext = setActiveGeneration(next);
            if (activeNext) rememberGeneration(activeNext);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(clientMessage(cause));
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [effectiveAccess, endFrame, generation, referenceFrames, rememberGeneration, restoredGenerationId, setActiveGeneration, startFrame]);

  useEffect(() => {
    if (effectiveAccess !== 'ready') return;
    const pending = customNodes.filter(node => node.type === 'image' && node.assetId && !customNodePreviewUrls[node.id]);
    if (!pending.length) return;
    let cancelled = false;
    Promise.allSettled(pending.map(async node => [node.id, await loadVideoAssetUrl(node.assetId!)] as const)).then(results => {
      if (cancelled) return;
      const resolved = results.reduce<Record<string, string>>((next, result) => {
        if (result.status === 'fulfilled' && result.value[1]) next[result.value[0]] = result.value[1];
        return next;
      }, {});
      if (Object.keys(resolved).length) {
        setCustomNodePreviewUrls(current => {
          const next = { ...current };
          Object.entries(resolved).forEach(([id, url]) => {
            if (!next[id]) next[id] = url;
          });
          return next;
        });
      }
    });
    return () => { cancelled = true; };
  }, [customNodePreviewUrls, customNodes, effectiveAccess]);

  useEffect(() => {
    if (!generationId || !generationStatus || !['queued', 'processing'].includes(generationStatus)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshVideoGeneration(generationId);
        if (cancelled || generationContextRef.current?.id !== generationId) return;
        const activeNext = setActiveGeneration(next);
        if (activeNext) rememberGeneration(activeNext);
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
  }, [generationId, generationStatus, rememberGeneration, setActiveGeneration]);

  useEffect(() => {
    if (!generationInFlight) return;
    const updateClock = () => setClockNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 5000);
    return () => window.clearInterval(timer);
  }, [generationInFlight]);

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

  useEffect(() => {
    const activeIds = new Set(customNodes.map(node => node.id));
    const previous = customNodePreviewUrlsRef.current;
    Object.entries(previous).forEach(([id, url]) => {
      if (!activeIds.has(id) && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    customNodePreviewUrlsRef.current = customNodePreviewUrls;
  }, [customNodePreviewUrls, customNodes]);

  useEffect(() => () => {
    Object.values(customNodePreviewUrlsRef.current).forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }, []);

  useEffect(() => () => {
    referenceFramesRef.current.forEach(frame => {
      if (frame.previewUrl.startsWith('blob:')) URL.revokeObjectURL(frame.previewUrl);
    });
  }, []);

  const uploadFrame = async (file: File): Promise<UploadedFrame> => {
    const dimensions = await imageDimensions(file);
    const assetId = await uploadVideoInput(file, dimensions);
    return { assetId, name: file.name, previewUrl: URL.createObjectURL(file), ...dimensions };
  };

  const upload = async (slot: 'start' | 'end', file: File) => {
    setUploading(slot);
    setError('');
    try {
      const next = await uploadFrame(file);
      if (slot === 'start') {
        if (startFrame) retireAsset(startFrame.assetId);
        setStartFrame(next);
        rememberImageAsset(next, 'start_frame');
        patchSemanticNode('source', { role: 'reference', assetId: next.assetId, status: 'draft' });
      } else {
        if (endFrame) retireAsset(endFrame.assetId);
        setEndFrame(next);
        rememberImageAsset(next, 'end_frame');
        patchSemanticNode('source', { role: 'reference', assetId: next.assetId, status: 'draft' });
      }
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
        const usedIndexes = new Set(referenceFrames.map((frame, index) => frameReferenceIndex(frame, index)));
        const indexed = uploaded.flatMap(frame => {
          const nextIndex = Array.from({ length: 9 }, (_, index) => index + 1).find(index => !usedIndexes.has(index));
          if (!nextIndex) return [];
          usedIndexes.add(nextIndex);
          return [{ ...frame, referenceIndex: nextIndex }];
        });
        if (indexed.length) {
          setReferenceFrames(current => [...current, ...indexed].slice(0, 9));
          indexed.forEach(frame => rememberImageAsset(frame, 'reference'));
          patchSemanticNode('source', { role: 'reference', assetId: indexed[0].assetId, status: 'draft' });
          notify(zh ? `已加入 ${indexed.length} 张全能参考图片。` : `${indexed.length} omni reference images added.`);
        }
        if (uploaded.length > indexed.length) setError(zh ? '参考图编号已占满，请先移除旧素材后再加入。' : 'All reference labels are occupied. Remove an old asset before adding another.');
      }
      if (failed?.status === 'rejected') setError(clientMessage(failed.reason));
      if (files.length > capacity) setError(zh ? `已达到 9 张上限，未加入其余 ${files.length - capacity} 张。` : `The 9-image limit was reached; ${files.length - capacity} files were skipped.`);
    } finally {
      setUploading(null);
    }
  };

  const addPromptReferences = (files: File[]) => {
    if (!files.length) return;
    setAgentPlan(null);
    setReferenceMode('omni');
    void uploadReferences(files);
  };

  const removeReference = (index: number) => {
    const target = referenceFrames[index];
    if (target) {
      retireAsset(target.assetId);
      if (highlightedAssetId === target.assetId) setHighlightedAssetId(null);
      if (scriptOcr.assetId === target.assetId) setScriptOcr({ assetId: null, status: 'idle', text: '', result: null, error: '' });
    }
    setReferenceFrames(current => {
      if (target?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const bindMentionToFrame = (frame: UploadedFrame, index: number, roleOverride?: CanvasAssetRole) => {
    const mentionIndex = frameReferenceIndex(frame, index);
    const mention = zh ? `@图片${mentionIndex}` : `@image${mentionIndex}`;
    const current = referenceBindingForFrame(frame, index, activeReferenceBindings);
    setCanvasSemantics(previous => recordCanvasEvent(bindCanvasAssetReference(previous, {
      token: mention,
      assetId: frame.assetId,
      role: roleOverride || current.role,
      priority: current.priority,
      strength: current.strength,
      required: current.required,
      constraints: current.constraints,
    }), {
      id: `asset-bound-${frame.assetId}-${mentionIndex}`,
      type: 'asset.bound',
      actor: 'user',
      message: 'reference-bound',
      metadata: { assetId: frame.assetId, mentionId: `image:${mentionIndex}`, role: current.role },
    }));
    setSelectedNodeId('source');
    setHighlightedAssetId(frame.assetId);
    return mention;
  };

  const mentionReference = (index: number) => {
    const frame = referenceFrames[index];
    if (!frame) return;
    const mention = bindMentionToFrame(frame, index);
    const mentionId = `image:${frameReferenceIndex(frame, index)}`;
    setPrompt(current => mentionId && parseCanvasAssetMentions(current).some(item => item.mentionId === mentionId)
      ? current
      : `${current.trim()} ${mention} `.trimStart());
  };

  const focusPromptMention = (mention: { index: number }) => {
    const candidate = mentionCandidates.find(item => frameReferenceIndex(item.frame, item.index) === mention.index);
    if (!candidate) return;
    setSelectedNodeId('source');
    setSelectedCustomNodeId(null);
    setHighlightedAssetId(candidate.frame.assetId);
  };

  const syncMentionMenu = (value: string, cursor: number) => {
    const safeCursor = Math.max(0, Math.min(cursor, value.length));
    const before = value.slice(0, safeCursor);
    const at = before.lastIndexOf('@');
    if (at < 0 || (at > 0 && !/[\s([{，。！？；：、“”‘’]/u.test(before[at - 1]))) {
      setMentionMenuOpen(false);
      setMentionStart(null);
      return;
    }
    const query = before.slice(at + 1);
    if (query.length > 18 || /\s/u.test(query)) {
      setMentionMenuOpen(false);
      setMentionStart(null);
      return;
    }
    setMentionStart(at);
    setMentionQuery(query);
    setMentionActiveIndex(0);
    setMentionMenuOpen(true);
  };

  const closeMentionMenu = () => {
    setMentionMenuOpen(false);
    setMentionStart(null);
    setMentionQuery('');
    setMentionActiveIndex(0);
  };

  const chooseMentionCandidate = (candidate: PromptMentionCandidate) => {
    const textarea = promptRef.current;
    const current = prompt;
    const cursor = textarea?.selectionStart ?? current.length;
    const start = mentionStart === null ? cursor : Math.min(mentionStart, cursor);
    const mention = bindMentionToFrame(candidate.frame, candidate.index, candidate.role);
    const nextPrompt = `${current.slice(0, start)}${mention} ${current.slice(cursor)}`.slice(0, 1200);
    setPrompt(nextPrompt);
    setAgentPlan(null);
    closeMentionMenu();
    requestAnimationFrame(() => {
      const nextCursor = Math.min(nextPrompt.length, start + mention.length + 1);
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionMenuOpen || filteredMentionCandidates.length === 0) {
      if (event.key === 'Escape') closeMentionMenu();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMentionActiveIndex(index => (index + 1) % filteredMentionCandidates.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setMentionActiveIndex(index => (index - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      chooseMentionCandidate(filteredMentionCandidates[mentionActiveIndex] || filteredMentionCandidates[0]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMentionMenu();
    }
  };

  const updateReferenceRole = (index: number, nextRole: CanvasAssetRole) => {
    const frame = referenceFrames[index];
    if (!frame) return;
    const mentionIndex = frameReferenceIndex(frame, index);
    const current = referenceBindingForFrame(frame, index, activeReferenceBindings);
    const scriptLike = nextRole === 'script' || nextRole === 'storyboard';
    setCanvasSemantics(previous => bindCanvasAssetReference(previous, {
      token: `@${zh ? '图片' : 'image'}${mentionIndex}`,
      assetId: frame.assetId,
      role: nextRole,
      priority: scriptLike ? Math.min(current.priority, 40) : current.priority,
      strength: scriptLike ? 'weak' : current.strength,
      required: scriptLike ? false : current.required,
      shotId: previous.shot.id,
      constraints: current.constraints,
    }));
    setAgentPlan(null);
    if (!scriptLike && scriptOcr.assetId === frame.assetId) {
      setScriptOcr({ assetId: null, status: 'idle', text: '', result: null, error: '' });
    }
    notify(zh ? `参考图 ${mentionIndex} 已标记为${canvasReferenceRoleLabel(nextRole, true)}。` : `Reference image ${mentionIndex} is now ${canvasReferenceRoleLabel(nextRole, false)}.`);
  };

  const extractScript = async (frame: UploadedFrame) => {
    if (scriptOcr.status === 'processing') return;
    setSelectedNodeId('source');
    setHighlightedAssetId(frame.assetId);
    setScriptOcr({ assetId: frame.assetId, status: 'processing', text: '', result: null, error: '' });
    setError('');
    try {
      const result = await extractScriptText(frame.assetId, zh ? 'zh' : 'en');
      setScriptOcr({ assetId: frame.assetId, status: 'ready', text: result.text, result, error: '' });
      notify(zh ? '脚本文字已提取，请检查后再插入 Motion Prompt。' : 'Script text was extracted. Review it before inserting into Motion Prompt.');
    } catch (cause) {
      const message = clientMessage(cause);
      setScriptOcr({ assetId: frame.assetId, status: 'error', text: '', result: null, error: message });
    }
  };

  const insertScriptOcr = () => {
    const extracted = scriptOcr.text.trim();
    if (!extracted) return;
    const source = scriptReferenceFrames.find(item => item.frame.assetId === scriptOcr.assetId) || scriptReferenceFrames[0];
    const mention = source ? (zh ? `@图片${frameReferenceIndex(source.frame, source.index)}` : `@image${frameReferenceIndex(source.frame, source.index)}`) : (zh ? '@脚本' : '@script');
    const prefix = `${zh ? '脚本参考' : 'Script reference'} ${mention}：`;
    const separator = prompt.trim() ? '\n\n' : '';
    const remaining = Math.max(0, 1200 - prompt.length - separator.length - prefix.length);
    if (remaining <= 0) {
      setError(zh ? 'Motion Prompt 已接近 1200 字上限，请先删减现有内容。' : 'Motion Prompt is near the 1,200-character limit. Shorten it before inserting the script.');
      return;
    }
    const clipped = extracted.slice(0, remaining);
    setPrompt(current => `${current.trimEnd()}${separator}${prefix}${clipped}`.slice(0, 1200));
    setAgentPlan(null);
    notify(clipped.length < extracted.length
      ? (zh ? '脚本已插入，但因 Prompt 上限截取了一部分；可在下方继续编辑。' : 'The script was inserted, but clipped to fit the Prompt limit. Continue editing below.')
      : (zh ? '脚本已插入 Motion Prompt，可继续编辑后生成。' : 'The script was inserted into Motion Prompt. Edit it before generating.'));
  };

  const updateScriptOcrText = (value: string) => {
    setScriptOcr(current => ({ ...current, text: value.slice(0, 12000), status: value.trim() ? 'ready' : 'error', error: value.trim() ? '' : (zh ? '请输入或重新提取脚本文字。' : 'Enter or extract the script text again.') }));
    setAgentPlan(null);
  };

  const toggleReferenceStrength = (index: number) => {
    const frame = referenceFrames[index];
    if (!frame) return;
    const mentionIndex = frameReferenceIndex(frame, index);
    const current = referenceBindingForFrame(frame, index, activeReferenceBindings);
    setCanvasSemantics(previous => bindCanvasAssetReference(previous, {
      token: `@${zh ? '图片' : 'image'}${mentionIndex}`,
      assetId: frame.assetId,
      role: current.role,
      priority: current.priority,
      strength: current.strength === 'strong' ? 'weak' : 'strong',
      required: current.required,
      shotId: previous.shot.id,
      constraints: current.constraints,
    }));
    setAgentPlan(null);
  };

  const changeReferenceMode = (next: ReferenceMode) => {
    if (next === 'text' && model !== 'veo-3.1-lite' && model !== 'auto') {
      notify(zh ? '纯文本生视频当前仅支持 Veo 3.1 Lite。' : 'Text-to-video is currently supported only by Veo 3.1 Lite.');
      return;
    }
    setReferenceMode(next);
    if (next === 'omni' && model === 'kling-3') notify(zh ? 'Kling 3.0 仅支持 START/END 首尾帧；请切换到 H3 或 Seedance 使用多图参考。' : 'Kling 3.0 supports START/END only. Switch to H3 or Seedance for Omni references.');
    if (next === 'omni' && model !== 'minimax-h3' && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p');
    if (next === 'text') {
      setDuration('8s');
      if (aspectRatio === '1:1') setAspectRatio('16:9');
      if (!['720p', '1080p', '4K'].includes(resolution)) setResolution('720p');
    }
  };

  const selectModel = (next: VideoModelId) => {
    // MiniMax H3 supports both FL2VA (start/end) and Ref2VA (multi-reference)
    // inputs. Keep the model selectable in either reference mode.
    setModel(next);
    patchSemanticNode('task', { model: next, provider: next === 'minimax-h3' ? 'minimax' : next === 'auto' ? null : next === 'kling-3' ? 'kling' : next === 'veo-3.1-lite' ? 'veo' : 'seedance' });
    setDuration(current => normalizeVideoDuration(next, current));
    if (next === 'minimax-h3') setResolution('768P');
    if (next === 'kling-3' && !['720p', '1080p', '4K'].includes(resolution)) setResolution('720p');
    if (next === 'veo-3.1-lite') {
      setReferenceMode('text');
      setDuration('8s');
      if (aspectRatio === '1:1') setAspectRatio('16:9');
      if (!['720p', '1080p', '4K'].includes(resolution)) setResolution('720p');
    } else if (next !== 'auto' && referenceMode === 'text') {
      setReferenceMode('start-end');
    }
    if (['seedance-2', 'seedance-2-5'].includes(next) && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p');
  };

  const prepareAlternateModel = () => {
    if (!alternateModelDetails?.enabled) {
      notify(zh ? `${modelName(alternateModel)} 尚未配置，暂时不能使用。` : `${modelName(alternateModel)} is not configured yet.`);
      return;
    }
    selectModel(alternateModel);
    setAgentPlan(null);
    setPreferencesOpen(true);
    setMinimapOpen(false);
    notify(zh ? `已切换到 ${modelName(alternateModel)} 分支，请确认参数后再提交。` : `Switched to the ${modelName(alternateModel)} branch. Review settings before submitting.`);
  };

  const planWithAgent = async () => {
    if (planning) return;
    if (!prompt.trim()) {
      setError(zh ? '先写一段 Motion Prompt，再让 Agent 规划。' : 'Add a Motion Prompt before asking the Agent to plan.');
      return;
    }
    const requestedModel = model;
    setPlanning(true);
    setError('');
    try {
      const next = await planVideoGeneration({
        prompt: prompt.trim(),
        preferredModel: model,
        referenceMode,
        referenceCount: referenceMode === 'text' ? 0 : referenceMode === 'omni' ? referenceFrames.length : (startFrame ? 1 : 0) + (endFrame ? 1 : 0),
        referenceImageAssetIds: referenceMode === 'omni' ? referenceFrames.map(frame => frame.assetId) : [],
        duration,
        aspectRatio,
        resolution,
        canvasContext: createCanvasAgentContext(captureCurrentShot(), selectedNodeId),
      });
      // The selected model is a user decision. Treat the plan response as
      // untrusted guidance and preserve the lock even if an upstream Agent
      // returns a different model.
      const lockedModel = requestedModel !== 'auto' ? requestedModel : next.model;
      const modelWasCorrected = requestedModel !== 'auto' && next.model !== requestedModel;
      const safePlan = modelWasCorrected
        ? {
            ...next,
            model: lockedModel,
            modelLabel: modelName(lockedModel),
            warnings: Array.from(new Set([...next.warnings, `已保留你选择的 ${modelName(lockedModel)}，Agent 不会擅自切换模型。`])),
          }
        : next;
      setAgentPlan(safePlan);
      setAppliedAgentActionIds([]);
      setModel(lockedModel);
      setReferenceMode(safePlan.referenceMode);
      setDuration(normalizeVideoDuration(lockedModel, safePlan.duration));
      if (safePlan.aspectRatio) setAspectRatio(safePlan.aspectRatio);
      setResolution(safePlan.resolution);
      patchSemanticNode('agent', { role: 'agent', status: 'completed', model: lockedModel, provider: safePlan.director.provider || null });
      setCanvasSemantics(previous => recordCanvasEvent(previous, {
        id: `agent-planned-${previous.shot.id}-${Date.now()}`,
        type: 'agent.planned',
        actor: 'agent',
        message: next.agentFallback ? 'rules-fallback' : 'agent-plan',
        metadata: {
          model: lockedModel,
          director: safePlan.director.id,
          confidence: typeof safePlan.confidence === 'number' ? safePlan.confidence : null,
          referenceCount: safePlan.referenceCount,
          warningCount: safePlan.warnings.length,
          modelCorrected: modelWasCorrected,
        },
      }));
      notify(modelWasCorrected
        ? (zh ? `已保留你锁定的 ${modelName(lockedModel)}；请检查 Agent 规划后再生成。` : `${modelName(lockedModel)} stays locked. Review the Agent plan before generating.`)
        : (zh ? `Agent 已完成规划：${safePlan.modelLabel}。请确认后再生成。` : `Agent selected ${safePlan.modelLabel}. Review the plan before generating.`));
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

  const applyAgentPrompt = () => {
    const optimized = agentPlan?.prompt.trim().slice(0, 1200) || '';
    if (!optimized || optimized === prompt.trim()) return;
    setPrompt(optimized);
    patchSemanticNode('prompt', { status: 'draft' });
    notify(zh ? '已应用 Agent 优化 Prompt；请再次检查后生成。' : 'The Agent prompt was applied. Review it once more before generating.');
  };

  const animateCurrentReference = () => {
    setSelectedNodeId('source');
    setPreferencesOpen(false);
    focusMotionPrompt();
    notify(hasReferenceInput
      ? (zh ? '已把当前参考素材带入图生视频流程，请补充 Motion Prompt。' : 'The current reference is ready for image-to-video. Add a Motion Prompt.')
      : (zh ? '先在镜头边界节点加入 START 或参考图，再开始 Animate。' : 'Add a START frame or reference image in the shot boundary node before animating.'));
  };

  const openNodePaletteFor = (parentId: string) => {
    setNodePaletteParentId(parentId);
    setNodePaletteOpen(true);
    setHistoryOpen(false);
    setCompareOpen(false);
    setTemplateOpen(false);
    setMinimapOpen(false);
  };
  const closeNodePalette = () => {
    setNodePaletteOpen(false);
    setNodePaletteParentId(null);
  };
  const toggleNodePalette = () => {
    setNodePaletteOpen(current => {
      const next = !current;
      if (next) {
        setNodePaletteParentId(null);
        setHistoryOpen(false);
        setCompareOpen(false);
        setTemplateOpen(false);
        setMinimapOpen(false);
      } else {
        setNodePaletteParentId(null);
      }
      return next;
    });
  };
  const toggleMinimap = () => {
    const next = !minimapOpen;
    setMinimapOpen(next);
    if (next) {
      setHistoryOpen(false);
      setCompareOpen(false);
      setNodePaletteOpen(false);
      setNodePaletteParentId(null);
      setTemplateOpen(false);
      setPreferencesOpen(false);
    }
  };
  const handlePaletteImage = async (file: File) => {
    if (nodePaletteParentId) {
      const created = createCustomNode('image', nodePaletteParentId, file.name);
      if (created) {
        setUploading('reference');
        try {
          const uploaded = await uploadFrame(file);
          setCustomNodes(current => current.map(node => node.id === created.id ? { ...node, assetId: uploaded.assetId, body: uploaded.name } : node));
          setCustomNodePreviewUrls(current => ({ ...current, [created.id]: uploaded.previewUrl }));
          rememberImageAsset(uploaded, 'reference');
          notify(zh ? '图片节点已绑定私有素材；主生成任务仍需你确认后提交。' : 'The image node is bound to a private asset; the main task still requires your confirmation.');
        } catch (cause) {
          setError(clientMessage(cause));
        } finally {
          setUploading(null);
        }
      }
      closeNodePalette();
      return;
    }
    if (referenceMode === 'omni') void uploadReferences([file]);
    else void upload('start', file);
  };
  const createCustomNode = (type: CanvasCustomNodeType, parentId: string, bodyOverride?: string) => {
    if (customNodes.length >= 12) {
      notify(zh ? '当前镜头最多添加 12 个自定义节点。' : 'This shot supports up to 12 custom nodes.');
      return null;
    }
    const parentFixed = (Object.keys(nodes) as NodeId[]).includes(parentId as NodeId);
    const parentPoint = parentFixed ? nodes[parentId as NodeId] : customNodes.find(node => node.id === parentId);
    const parentWidth = parentFixed ? nodeSize[parentId as NodeId].width : CUSTOM_NODE_SIZE.width;
    const parentX = parentPoint?.x ?? nodes.result.x;
    const parentY = parentPoint?.y ?? nodes.result.y;
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const labels = CUSTOM_NODE_LABELS[type];
    const next: CanvasCustomNode = {
      id,
      type,
      parentId,
      x: clamp(parentX + parentWidth + 72, 18, STAGE_SIZE.width - CUSTOM_NODE_SIZE.width - 18),
      y: clamp(parentY + (customNodes.length % 3) * 34, 18, STAGE_SIZE.height - CUSTOM_NODE_SIZE.height - 18),
      title: labels.zh,
      body: bodyOverride || labels.hintZh,
      assetId: null,
    };
    setCustomNodes(current => [...current, next].slice(-12));
    setCustomEdges(current => [...current, { id: `${parentId}-${id}`, from: parentId, to: id }].slice(-24));
    setSelectedNodeId(null);
    setSelectedCustomNodeId(id);
    notify(zh ? `已添加${labels.zh}节点，并连接到当前步骤。` : `${labels.en} node added and connected to the current step.`);
    return next;
  };
  const addTextNode = () => {
    if (nodePaletteParentId) {
      createCustomNode('text', nodePaletteParentId);
      closeNodePalette();
      return;
    }
    closeNodePalette();
    focusMotionPrompt();
  };
  const addVideoNode = () => {
    if (nodePaletteParentId) {
      createCustomNode('video', nodePaletteParentId);
      closeNodePalette();
      return;
    }
    closeNodePalette();
    const readyModel = models.find(item => item.enabled && item.id !== 'auto');
    if (!selectedModel?.enabled && readyModel) selectModel(readyModel.id);
    focusMotionPrompt();
    notify(zh ? `视频生成节点已就绪：${modelName(readyModel?.id || model)}。请在下方补齐参数。` : `Video generation is ready with ${modelName(readyModel?.id || model)}. Complete the settings below.`);
  };
  const addOtherNode = () => {
    if (nodePaletteParentId) {
      createCustomNode('other', nodePaletteParentId);
      closeNodePalette();
      return;
    }
    closeNodePalette();
    notify(zh ? '请从节点右侧的 + 添加一个自定义步骤。' : 'Use the + on a node to add a custom step.');
  };
  const addReferenceNode = () => {
    setReferenceMode('omni');
    closeNodePalette();
    notify(zh ? '已切换到全能参考，可在画布左侧加入最多 9 张图片。' : 'Omni reference is ready. Add up to 9 images from the left node.');
  };
  const toggleTemplatePicker = () => {
    setTemplateOpen(current => {
      const next = !current;
      if (next) {
        setPreferencesOpen(false);
        setHistoryOpen(false);
        setCompareOpen(false);
        setNodePaletteOpen(false);
        setMinimapOpen(false);
      } else {
        setNodePaletteParentId(null);
      }
      return next;
    });
  };
  const applyCanvasTemplate = (template: CanvasTemplate) => {
    const nextResolution = compatibleTemplateResolution(model, template.resolution);
    setPrompt(zh ? template.promptZh : template.promptEn);
    setReferenceMode(template.referenceMode);
    setDuration(normalizeVideoDuration(model, template.duration));
    setAspectRatio(template.aspectRatio);
    setResolution(nextResolution);
    setAgentPlan(null);
    patchSemanticNode('prompt', { status: 'draft' });
    setTemplateOpen(false);
    notify(zh
      ? `已应用“${template.labelZh}”模板，保留当前 ${modelName(model)}；请检查参考图和参数后再生成。`
      : `“${template.labelEn}” applied. ${modelName(model)} stays selected; review references and settings before generating.`);
  };

  const submitGenerationForModel = async (selectedModelId: Exclude<VideoModelId, 'auto'>, primaryFrame: UploadedFrame | null) => {
    if (selectedModelId === 'veo-3.1-lite') {
      if (referenceMode !== 'text') throw new Error(zh ? 'Veo 3.1 Lite 只支持纯文本生视频。' : 'Veo 3.1 Lite only supports text-to-video.');
    } else if (!primaryFrame) {
      throw new Error(zh ? '当前模型需要 START 图片。' : 'This model needs a START image.');
    }
    if (selectedModelId === 'minimax-h3') {
      if (referenceMode === 'omni') referenceFrames.forEach((frame, index) => assertMiniMaxFrame(frame, `${zh ? '参考图' : 'Reference image'} ${index + 1}`));
      else {
        assertMiniMaxFrame(primaryFrame as UploadedFrame, 'START');
        if (endFrame) assertMiniMaxFrame(endFrame, 'END');
      }
    }
    return createVideoGeneration({
      model: selectedModelId,
      prompt: prompt.trim(),
      startImageAssetId: referenceMode === 'text' ? null : primaryFrame?.assetId || null,
      endImageAssetId: referenceMode === 'start-end' ? endFrame?.assetId || null : null,
      referenceMode,
      referenceImageAssetIds: referenceMode === 'omni' ? referenceFrames.map(frame => frame.assetId) : [],
      referenceBindings: canvasSemantics.references,
      duration,
      aspectRatio,
      resolution,
      generationGroupId: generationGroupIdRef.current || (generationGroupIdRef.current = globalThis.crypto?.randomUUID?.() || uuidV4Fallback()),
      shotId: canvasSemantics.shot.id,
      shotOrder: canvasSemantics.shot.order,
    });
  };

  const generate = async () => {
    const primaryFrame = referenceMode === 'omni' ? referenceFrames[0] : startFrame;
    if (!canGenerate || !effectiveModel || (referenceMode !== 'text' && !primaryFrame)) return;
    setSubmitting(true);
    setError('');
    setVideoUrl('');
    try {
      const next = await submitGenerationForModel(effectiveModel, primaryFrame);
      const activeNext = setActiveGeneration(next);
      if (activeNext) {
        rememberGeneration(activeNext);
        setRestoredGenerationId(activeNext.id);
      }
      notify(zh ? '镜头任务已创建，画布会自动同步进度。' : 'Shot created. The canvas will sync progress automatically.');
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const compareGenerate = async () => {
    const primaryFrame = referenceMode === 'omni' ? referenceFrames[0] : startFrame;
    const selected = [...new Set(compareModels)].slice(0, 3);
    if (!canCompare || (referenceMode !== 'text' && !primaryFrame) || selected.length < 2) return;
    setSubmitting(true);
    setError('');
    setVideoUrl('');
    try {
      for (const selectedModelId of selected) {
        const next = await submitGenerationForModel(selectedModelId, primaryFrame);
        const activeNext = setActiveGeneration(next);
        if (activeNext) {
          rememberGeneration(activeNext);
          setRestoredGenerationId(activeNext.id);
        }
      }
      setCompareOpen(true);
      notify(zh ? `已为当前镜头提交 ${selected.length} 个模型版本，结果会保留在对比面板。` : `Submitted ${selected.length} model versions for this shot. Results stay in the compare panel.`);
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
      const currentSnapshot = captureCurrentShot();
      const nextShot = nextShotNumber();
      const nextStartFrame: UploadedFrame = {
        assetId: generation.thumbnailAssetId,
        name: (zh ? '镜头 ' : 'Shot ') + String(shot) + (zh ? ' 结果帧' : ' result frame'),
        previewUrl: url,
        width: 1280,
        height: 720,
      };
      const nextSemantics = createCanvasSemantics(nextShot);
      nextSemantics.assets = [...canvasSemantics.assets
        .filter(asset => asset.role !== 'output')
        .map(asset => ({ ...asset, shotId: nextSemantics.shot.id })), {
        assetId: generation.thumbnailAssetId,
        kind: 'image',
        role: 'start_frame',
        shotId: nextSemantics.shot.id,
        generationId: generation.id,
        versionId: currentVersion?.id || `generation-${generation.id}-v1`,
        name: (zh ? '镜头 ' : 'Shot ') + String(shot) + (zh ? ' 结果帧' : ' result frame'),
        width: 1280,
        height: 720,
      }];
      // A new shot starts with a clean generation branch; the previous
      // thumbnail remains available as its START asset below.
      nextSemantics.generations = [];
      nextSemantics.versions = [];
      const nextSnapshot: ShotSnapshot = {
        shot: nextShot,
        nodes: { ...nodes },
        prompt: '',
        model,
        duration,
        aspectRatio,
        resolution,
        startFrame: nextStartFrame,
        endFrame: null,
        referenceMode: 'start-end',
        referenceFrames: [],
        generation: null,
        restoredGenerationId: null,
        videoUrl: '',
        agentPlan: null,
        semantics: patchCanvasNode(nextSemantics, 'source', { role: 'reference', assetId: generation.thumbnailAssetId, status: 'draft' }),
        scriptOcr: null,
      };
      setShotSnapshots(previous => upsertShotSnapshot(upsertShotSnapshot(previous, currentSnapshot), nextSnapshot));
      applyShotSnapshot(nextSnapshot);
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
    setSelectedNodeId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, clientX: event.clientX, clientY: event.clientY, origin: nodes[id] };
  };
  const startCustomNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    event.stopPropagation();
    setSelectedNodeId(null);
    setSelectedCustomNodeId(id);
    const node = customNodes.find(item => item.id === id);
    if (!node) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    customDragRef.current = { id, clientX: event.clientX, clientY: event.clientY, origin: { x: node.x, y: node.y } };
  };
  const moveCustomNode = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = customDragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / viewport.scale;
    const dy = (event.clientY - drag.clientY) / viewport.scale;
    setCustomNodes(previous => previous.map(node => node.id === drag.id ? {
      ...node,
      x: clamp(drag.origin.x + dx, 18, STAGE_SIZE.width - CUSTOM_NODE_SIZE.width - 18),
      y: clamp(drag.origin.y + dy, 18, STAGE_SIZE.height - CUSTOM_NODE_SIZE.height - 18),
    } : node));
  };
  const endCustomNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    customDragRef.current = null;
  };
  const moveCustomNodeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>, id: string) => {
    const direction = ({
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    } as Record<string, Point>)[event.key];
    if (!direction) return;
    event.preventDefault();
    const distance = event.shiftKey ? 48 : 16;
    setSelectedCustomNodeId(id);
    setCustomNodes(previous => previous.map(node => node.id === id ? {
      ...node,
      x: clamp(node.x + direction.x * distance, 18, STAGE_SIZE.width - CUSTOM_NODE_SIZE.width - 18),
      y: clamp(node.y + direction.y * distance, 18, STAGE_SIZE.height - CUSTOM_NODE_SIZE.height - 18),
    } : node));
  };
  const removeCustomNode = (id: string) => {
    if (!window.confirm(zh ? '删除这个自定义节点？它的连接也会移除。' : 'Delete this custom node and its connections?')) return;
    setCustomNodes(previous => previous.filter(node => node.id !== id));
    setCustomEdges(previous => previous.filter(edge => edge.from !== id && edge.to !== id));
    setCustomNodePreviewUrls(previous => {
      const next = { ...previous };
      const url = next[id];
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      delete next[id];
      return next;
    });
    if (selectedCustomNodeId === id) setSelectedCustomNodeId(null);
    notify(zh ? '自定义节点已移除，主生成链路未改变。' : 'Custom node removed; the main generation flow was unchanged.');
  };

  const addSelectedImageToReferences = async () => {
    const node = selectedCanvasImageNode;
    if (!node?.assetId) {
      notify(zh ? '这个图片节点还没有绑定可用素材。' : 'This image node is not bound to an available asset yet.');
      return;
    }
    const existing = referenceFrames.find(frame => frame.assetId === node.assetId);
    if (existing) {
      setReferenceMode('omni');
      setSelectedNodeId('source');
      setSelectedCustomNodeId(null);
      setHighlightedAssetId(existing.assetId);
      notify(zh ? '这张图片已经在全能参考中。' : 'This image is already in the omni reference set.');
      return;
    }
    if (referenceFrames.length >= 9) {
      notify(zh ? '全能参考已达到 9 张上限，请先移除一张。' : 'The omni reference set is full. Remove one image first.');
      return;
    }
    try {
      const asset = await loadVideoAsset(node.assetId);
      const usedIndexes = new Set(referenceFrames.map((frame, index) => frameReferenceIndex(frame, index)));
      const referenceIndex = Array.from({ length: 9 }, (_, index) => index + 1).find(index => !usedIndexes.has(index)) || referenceFrames.length + 1;
      const frame: UploadedFrame = {
        assetId: node.assetId,
        name: node.body || (zh ? '画布图片' : 'Canvas image'),
        previewUrl: asset.url,
        width: asset.width || 0,
        height: asset.height || 0,
        referenceIndex,
      };
      setReferenceMode('omni');
      setReferenceFrames(current => [...current, frame].slice(0, 9));
      rememberImageAsset(frame, 'reference');
      const mention = bindMentionToFrame(frame, referenceIndex - 1);
      setPrompt(current => current.includes(mention) ? current : `${current.trim()} ${mention}`.trim());
      setAgentPlan(null);
      setSelectedNodeId('source');
      setSelectedCustomNodeId(null);
      setHighlightedAssetId(node.assetId);
      notify(zh ? `已加入全能参考，并插入 ${mention}。` : `Added to omni references and inserted ${mention}.`);
    } catch (cause) {
      setError(clientMessage(cause));
    }
  };

  const openSelectedImagePreview = () => {
    const url = selectedCanvasImageNode ? customNodePreviewUrls[selectedCanvasImageNode.id] : '';
    if (!url) {
      notify(zh ? '高清预览尚未准备好。' : 'The high-resolution preview is not ready yet.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const updateCustomNodeBody = (id: string, body: string) => {
    setCustomNodes(previous => previous.map(node => node.id === id ? { ...node, body: body.slice(0, 1200) } : node));
  };

  const cancelGeneration = async () => {
    if (!generation || !generationInFlight || cancelling) return;
    setCancelling(true);
    setError('');
    try {
      const result = await cancelVideoGeneration(generation.id);
      const activeGeneration = setActiveGeneration(result.generation);
      if (activeGeneration) {
        rememberGeneration(activeGeneration);
        setRestoredGenerationId(activeGeneration.id);
      }
      const providerStopped = result.providerCancellation === 'confirmed' || result.providerCancellation === 'requested';
      notify(providerStopped
        ? (zh ? '已停止生成，并向中转站发送了取消请求。冻结积分已退回。' : 'Generation stopped and a cancellation was sent upstream. Frozen credits were returned.')
        : (zh ? '已停止本站任务，冻结积分已退回。中转站当前未提供可用的中途取消接口，已开始的上游渲染可能仍会继续。' : 'The local task has stopped and frozen credits were returned. APIMart did not expose a usable cancellation endpoint, so upstream rendering may continue if it already started.'));
    } catch (cause) {
      setError(clientMessage(cause));
    } finally {
      setCancelling(false);
    }
  };
  const moveNode = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / viewport.scale;
    const dy = (event.clientY - drag.clientY) / viewport.scale;
    setNodes(previous => CanvasCommandService.moveNode(previous, drag.id, {
      x: clamp(drag.origin.x + dx, 0, STAGE_SIZE.width - nodeSize[drag.id].width),
      y: clamp(drag.origin.y + dy, 0, STAGE_SIZE.height - nodeSize[drag.id].height),
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
    setSelectedNodeId(id);
    setNodes(previous => CanvasCommandService.moveNode(previous, id, {
      x: clamp(previous[id].x + direction.x * distance, 0, STAGE_SIZE.width - nodeSize[id].width),
      y: clamp(previous[id].y + direction.y * distance, 0, STAGE_SIZE.height - nodeSize[id].height),
    }));
  };

  const startShotDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    shotDragRef.current = { clientX: event.clientX, clientY: event.clientY, origin: nodes, customOrigin: customNodes.map(node => ({ ...node })) };
  };
  const moveShot = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = shotDragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / viewport.scale;
    const dy = (event.clientY - drag.clientY) / viewport.scale;
    const ids: NodeId[] = ['source', 'agent', 'task', 'result'];
    setNodes(previous => {
      const next: Partial<NodePositions> = {};
      ids.forEach(id => {
        next[id] = {
          x: clamp(drag.origin[id].x + dx, 0, STAGE_SIZE.width - nodeSize[id].width),
          y: clamp(drag.origin[id].y + dy, 0, STAGE_SIZE.height - nodeSize[id].height),
        };
      });
      return CanvasCommandService.moveNodes(previous, next);
    });
    setCustomNodes(previous => previous.map(node => {
      const origin = drag.customOrigin.find(item => item.id === node.id);
      if (!origin) return node;
      return {
        ...node,
        x: clamp(origin.x + dx, 18, STAGE_SIZE.width - CUSTOM_NODE_SIZE.width - 18),
        y: clamp(origin.y + dy, 18, STAGE_SIZE.height - CUSTOM_NODE_SIZE.height - 18),
      };
    }));
  };
  const endShotDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    shotDragRef.current = null;
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.video-canvas-node, .video-canvas-toolbar, .video-canvas-composer, .canvas-minimap-panel, .canvas-selected-asset-toolbar')) return;
    setSelectedNodeId(null);
    setSelectedCustomNodeId(null);
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

  const createNextShot = (duplicate = false) => {
    if (shotActionsDisabled) {
      notify(zh ? '当前任务完成后才可创建镜头。' : 'Finish the current task before creating another shot.');
      return false;
    }
    const currentSnapshot = captureCurrentShot();
    const nextShot = nextShotNumber();
    const nextSemantics = createCanvasSemantics(nextShot);
    nextSemantics.assets = canvasSemantics.assets
      .filter(asset => asset.role !== 'output')
      .map(asset => ({ ...asset, shotId: nextSemantics.shot.id }));
    // Duplicating a shot copies its inputs, not its historical generations.
    // This keeps Agent context and Best Take selection scoped to one shot.
    nextSemantics.generations = [];
    nextSemantics.versions = [];
    const primaryAssetId = referenceMode === 'omni' ? referenceFrames[0]?.assetId : startFrame?.assetId;
    const nextSnapshot: ShotSnapshot = duplicate ? {
      ...currentSnapshot,
      shot: nextShot,
      startFrame: cloneFrame(currentSnapshot.startFrame),
      endFrame: cloneFrame(currentSnapshot.endFrame),
      referenceFrames: currentSnapshot.referenceFrames.map(frame => ({ ...frame })),
      generation: null,
      restoredGenerationId: null,
      videoUrl: '',
      agentPlan: null,
      semantics: nextSemantics,
    } : {
      shot: nextShot,
      nodes: { ...nodes },
      prompt: '',
      model,
      duration,
      aspectRatio,
      resolution,
      startFrame: null,
      endFrame: null,
      referenceMode: 'start-end',
      referenceFrames: [],
      generation: null,
      restoredGenerationId: null,
      videoUrl: '',
      agentPlan: null,
      semantics: nextSemantics,
      scriptOcr: null,
    };
    if (duplicate) {
      nextSnapshot.semantics = patchCanvasNode(nextSemantics, 'source', {
        role: 'reference',
        assetId: primaryAssetId || null,
        status: 'draft',
      });
    }
    setShotSnapshots(previous => upsertShotSnapshot(upsertShotSnapshot(previous, currentSnapshot), nextSnapshot));
    applyShotSnapshot(nextSnapshot);
    notify(duplicate
      ? (zh ? `已复制镜头 ${String(shot).padStart(2, '0')}，创建镜头 ${String(nextShot).padStart(2, '0')}。` : `Shot ${String(shot).padStart(2, '0')} duplicated as shot ${String(nextShot).padStart(2, '0')}.`)
      : (zh ? `已创建镜头 ${String(nextShot).padStart(2, '0')}。` : `Shot ${String(nextShot).padStart(2, '0')} created.`));
    return true;
  };

  const organizeCanvas = () => {
    setNodes(previous => CanvasCommandService.resetLayout(previous, INITIAL_NODES));
    setCustomNodes(previous => previous.map((node, index) => ({
      ...node,
      x: clamp(1500 + (index % 2) * 300, 18, STAGE_SIZE.width - CUSTOM_NODE_SIZE.width - 18),
      y: clamp(120 + Math.floor(index / 2) * 220, 18, STAGE_SIZE.height - CUSTOM_NODE_SIZE.height - 18),
    })));
    setViewport(INITIAL_VIEWPORT);
    setSelectedNodeId(null);
    setSelectedCustomNodeId(null);
    notify(zh ? '已按默认流程整理当前画布。' : 'The current canvas was organized into the default flow.');
    return true;
  };

  const applyAgentAction = (action: CanvasAgentAction) => {
    if (appliedAgentActionIds.includes(action.id)) return;
    if (action.shotId && action.shotId !== canvasSemantics.shot.id) {
      notify(zh ? '这条建议针对其他镜头，已阻止应用。' : 'This suggestion targets another shot and was blocked.');
      return;
    }
    const applied = action.type === 'canvas.organize'
      ? organizeCanvas()
      : action.type === 'shot.create'
      ? createNextShot(false)
      : action.type === 'shot.duplicate'
        ? createNextShot(true)
        : action.type === 'shot.reorder'
          ? reorderCurrentShot(action.direction || 'down')
          : deleteCurrentShot();
    if (applied) setAppliedAgentActionIds(previous => previous.includes(action.id) ? previous : [...previous, action.id]);
  };

  const toggleShotCollapsed = () => {
    setCanvasSemantics(previous => patchCanvasShot(previous, { collapsed: !previous.shot.collapsed }));
  };

  const toggleCustomLayoutMode = () => {
    const next = !customLayoutMode;
    setCustomLayoutMode(next);
    if (next && canvasSemantics.shot.collapsed) {
      setCanvasSemantics(previous => patchCanvasShot(previous, { collapsed: false }));
    }
    notify(next
      ? (zh ? '已进入自定义排列：拖动节点即可调整，位置会自动保存。' : 'Custom layout is on. Drag nodes to arrange them; positions save automatically.')
      : (zh ? '已退出自定义排列。' : 'Custom layout is off.'));
  };

  const graphNodes = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>();
    (Object.keys(nodes) as NodeId[]).forEach(id => map.set(id, { ...nodes[id], ...nodeSize[id] }));
    customNodes.forEach(node => map.set(node.id, { x: node.x, y: node.y, ...CUSTOM_NODE_SIZE }));
    return map;
  }, [customNodes, nodeSize, nodes]);

  const shotFrame = useMemo(() => {
    const frameNodes = ['source', 'agent', 'task', 'result', ...customNodes.map(node => node.id)]
      .map(id => graphNodes.get(id))
      .filter((node): node is { x: number; y: number; width: number; height: number } => Boolean(node));
    const minX = Math.min(...frameNodes.map(node => node.x));
    const minY = Math.min(...frameNodes.map(node => node.y));
    const maxX = Math.max(...frameNodes.map(node => node.x + node.width));
    const maxY = Math.max(...frameNodes.map(node => node.y + node.height));
    return { x: minX - 32, y: minY - 64, width: maxX - minX + 64, height: maxY - minY + 96 };
  }, [customNodes, graphNodes]);

  const fitCanvasToContent = () => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      setViewport(INITIAL_VIEWPORT);
      return;
    }
    setViewport(fitViewportForFrame(shotFrame, {
      width: viewportElement.clientWidth,
      height: viewportElement.clientHeight,
    }));
  };

  const minimapNodes = useMemo(() => Array.from(graphNodes.entries())
    .filter(([id]) => id !== 'prompt' && id !== 'model')
    .map(([id, node]) => ({ id, ...node })), [graphNodes]);

  const minimapViewport = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return null;
    const width = Math.min(STAGE_SIZE.width, viewportSize.width / viewport.scale);
    const height = Math.min(STAGE_SIZE.height, viewportSize.height / viewport.scale);
    return {
      left: clamp(-viewport.x / viewport.scale, 0, Math.max(0, STAGE_SIZE.width - width)),
      top: clamp(-viewport.y / viewport.scale, 0, Math.max(0, STAGE_SIZE.height - height)),
      width,
      height,
    };
  }, [viewport.scale, viewport.x, viewport.y, viewportSize.height, viewportSize.width]);

  const selectedCanvasImageNode = selectedCustomNodeId
    ? customNodes.find(node => node.id === selectedCustomNodeId && node.type === 'image') || null
    : null;
  const selectedImageToolbarPosition = useMemo(() => {
    if (!selectedCanvasImageNode) return null;
    const toolbarWidth = 352;
    const width = viewportSize.width || 900;
    const height = viewportSize.height || 600;
    return {
      left: clamp((selectedCanvasImageNode.x + CUSTOM_NODE_SIZE.width / 2) * viewport.scale + viewport.x - toolbarWidth / 2, 12, Math.max(12, width - toolbarWidth - 12)),
      top: clamp(selectedCanvasImageNode.y * viewport.scale + viewport.y - 64, 56, Math.max(56, height - 68)),
    };
  }, [selectedCanvasImageNode, viewport.scale, viewport.x, viewport.y, viewportSize.height, viewportSize.width]);

  const focusCanvasNode = (id: string) => {
    const node = graphNodes.get(id);
    const viewportElement = viewportRef.current;
    if (!node || !viewportElement) return;
    setViewport(previous => ({
      ...previous,
      x: viewportElement.clientWidth / 2 - (node.x + node.width / 2) * previous.scale,
      y: viewportElement.clientHeight / 2 - (node.y + node.height / 2) * previous.scale,
    }));
    if ((Object.keys(nodes) as NodeId[]).includes(id as NodeId)) {
      setSelectedNodeId(id as NodeId);
      setSelectedCustomNodeId(null);
    } else {
      setSelectedNodeId(null);
      setSelectedCustomNodeId(id);
    }
    setMinimapOpen(false);
  };

  const edges = useMemo(() => [...CONNECTIONS.map(([from, to]) => ({ from, to, id: from + '-' + to })), ...customEdges.map(edge => ({ ...edge, id: `custom-${edge.id}` }))].flatMap(edge => {
    const from = graphNodes.get(edge.from);
    const to = graphNodes.get(edge.to);
    if (!from || !to) return [];
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x, y: to.y + to.height / 2 };
    const curve = Math.max(90, Math.abs(end.x - start.x) * 0.45);
    return [{
      id: edge.id,
      d: 'M ' + start.x + ' ' + start.y + ' C ' + (start.x + curve) + ' ' + start.y + ', ' + (end.x - curve) + ' ' + end.y + ', ' + end.x + ' ' + end.y,
    }];
  }), [customEdges, graphNodes]);
  const paletteParentName = nodePaletteParentId
    ? ((Object.keys(nodes) as NodeId[]).includes(nodePaletteParentId as NodeId)
      ? canvasNodeName(nodePaletteParentId as NodeId, zh)
      : CUSTOM_NODE_LABELS[customNodes.find(node => node.id === nodePaletteParentId)?.type || 'other'][zh ? 'zh' : 'en'])
    : '';

  if (effectiveAccess === 'signed-out') return <main className="app-page video-canvas-access"><span>AI CANVAS</span><h1>{zh ? '登录后进入镜头画布。' : 'Sign in to open the shot canvas.'}</h1><p>{zh ? '画布使用现有团队生成服务，不会在浏览器保存第三方密钥。' : 'The canvas uses the existing Team service and never stores provider keys in the browser.'}</p><button type="button" className="primary" onClick={onSignIn}>{zh ? '使用 Google 登录' : 'Sign in with Google'}</button></main>;
  if (effectiveAccess === 'team-only') return <main className="app-page video-canvas-access denied"><span>TEAM ACCESS</span><h1>{zh ? '这个账号还没有 AI 画布权限。' : 'This account does not have AI Canvas access.'}</h1><p>{zh ? '请让站点主人在账号目录中开通 Team 权限。' : 'Ask the owner to grant Team access in the account directory.'}</p></main>;

  return <main className="app-page video-canvas-page">
    <header className="video-canvas-intro">
      <div><span>AI STUDIO · SHOT CANVAS</span><h1>{zh ? '把镜头思路铺开，再交给模型。' : 'Lay out the shot before handing it to the model.'}</h1><p>{zh ? '拖拽节点组织一次图生视频任务；底层仍复用现有 Provider、异步任务、积分和媒体存储。' : 'Arrange one image-to-video task with draggable nodes while reusing the existing providers, task lifecycle, credits, and storage.'}</p></div>
      <aside><b>{zh ? '画布状态' : 'Canvas state'}</b><span>{zh ? '当前设备自动保存' : 'Auto-saved on this device'}</span><button type="button" onClick={organizeCanvas}>{zh ? '整理画布' : 'Tidy canvas'}</button></aside>
    </header>

    <div className="video-canvas-model-pill" role="status" aria-live="polite">
      <span className="video-canvas-model-mark" aria-hidden="true">✦</span>
      <span className="video-canvas-model-copy"><b>{modelName(model)}</b><small>{selectedModel?.enabled ? (zh ? '已就绪 · Team 可用' : 'Ready · Team access') : (zh ? '待配置服务端模型' : 'Provider configuration required')}</small></span>
      <span className={'video-canvas-model-state ' + (selectedModel?.enabled ? 'ready' : 'pending')}><i />{selectedModel?.enabled ? (zh ? '已上线' : 'Online') : (zh ? '待配置' : 'Pending')}</span>
      <span className="video-canvas-model-spec">{duration} · {resolution}</span>
    </div>

    {error && <div className="video-canvas-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>{zh ? '关闭' : 'Dismiss'}</button></div>}

    <section ref={canvasShellRef} className={'video-canvas-shell ' + (isCanvasFullscreen ? 'is-canvas-fullscreen' : '')} data-shot-id={canvasSemantics.shot.id} data-shot-status={canvasSemantics.shot.status} aria-label={zh ? 'AI 图生视频无限画布' : 'AI image-to-video infinite canvas'}>
      <div className="video-canvas-caption">
        <div className="video-canvas-caption-project"><span className="canvas-project-mark" aria-hidden="true">SC</span><div><b>{zh ? '未命名镜头项目' : 'Untitled shot project'}</b><small><i aria-hidden="true" />{zh ? '已保存到本地' : 'Saved locally'}</small></div></div>
        <div className="video-canvas-caption-center">
          <div className="canvas-shot-rail" aria-label={zh ? '镜头列表' : 'Shot list'}>
            <small>SHOTS</small>
            {shotRailItems.map(item => {
              const index = item.shot;
              return <button key={index} type="button" className={'canvas-shot-rail-item ' + (index === shot ? 'is-current' : '')} aria-current={index === shot ? 'step' : undefined} aria-label={zh ? `切换到镜头 ${String(index).padStart(2, '0')}` : `Switch to shot ${String(index).padStart(2, '0')}`} onClick={() => switchShot(index)}><b>{String(index).padStart(2, '0')}</b><i className={item.status} aria-hidden="true" /></button>;
            })}
          </div>
          <p>{zh ? '拖动空白区域移动画布，滚轮缩放。' : 'Drag the background to pan, use the wheel to zoom.'}</p>
        </div>
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
        onClick={event => {
          const target = event.target as HTMLElement;
          if (!target.closest('.video-canvas-node, .canvas-custom-node, .video-canvas-toolbar, .video-canvas-composer, .canvas-minimap-panel, .canvas-selected-asset-toolbar')) {
            setSelectedNodeId(null);
            setSelectedCustomNodeId(null);
          }
        }}
      >
        <div className="video-canvas-toolbar" aria-label={zh ? '画布缩放' : 'Canvas zoom'}>
          <button type="button" onClick={() => zoomAt(viewport.scale / 1.12)} aria-label={zh ? '缩小' : 'Zoom out'}>−</button>
          <button type="button" onClick={() => zoomAt(1)}>{Math.round(viewport.scale * 100)}%</button>
          <button type="button" onClick={() => zoomAt(viewport.scale * 1.12)} aria-label={zh ? '放大' : 'Zoom in'}>＋</button>
          <button type="button" onClick={fitCanvasToContent} title={zh ? '让当前镜头的节点完整进入视野' : 'Fit the current shot into view'}>{zh ? '回到流程' : 'Fit'}</button>
          <button type="button" className={'canvas-minimap-toolbar-button ' + (minimapOpen ? 'is-open' : '')} aria-expanded={minimapOpen} aria-controls="canvas-minimap-panel" onClick={toggleMinimap} aria-label={minimapOpen ? (zh ? '关闭画布导航' : 'Close canvas map') : (zh ? '打开画布导航' : 'Open canvas map')} title={minimapOpen ? (zh ? '关闭画布导航' : 'Close canvas map') : (zh ? '打开画布导航' : 'Open canvas map')}><span aria-hidden="true">▦</span><b>{zh ? '导航' : 'Map'}</b></button>
          <button type="button" className="canvas-history-toolbar-button" aria-expanded={historyOpen} aria-controls="canvas-history-panel" onClick={toggleHistory} aria-label={historyOpen ? (zh ? '关闭生成历史' : 'Close generation history') : (zh ? '打开生成历史' : 'Open generation history')} title={historyOpen ? (zh ? '关闭生成历史' : 'Close generation history') : (zh ? '打开生成历史' : 'Open generation history')}><span aria-hidden="true">▤</span><b>{zh ? '历史' : 'History'}</b>{history.length > 0 && <i aria-hidden="true">{history.length > 99 ? '99+' : history.length}</i>}</button>
          <button type="button" className="canvas-fullscreen-button" onClick={() => void toggleCanvasFullscreen()} aria-label={isCanvasFullscreen ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '进入全屏' : 'Enter fullscreen')} title={isCanvasFullscreen ? (zh ? '退出全屏（Esc）' : 'Exit fullscreen (Esc)') : (zh ? '进入全屏' : 'Enter fullscreen')}><span aria-hidden="true">{isCanvasFullscreen ? '↙' : '⛶'}</span><b>{isCanvasFullscreen ? (zh ? '退出' : 'Exit') : (zh ? '全屏' : 'Full')}</b></button>
        </div>
        {minimapOpen && <aside id="canvas-minimap-panel" className="canvas-minimap-panel" role="dialog" aria-labelledby="canvas-minimap-title">
          <div className="canvas-minimap-head"><div><span>{zh ? '画布导航' : 'CANVAS MAP'}</span><b id="canvas-minimap-title">{zh ? '当前镜头概览' : 'Current shot overview'}</b></div><button type="button" className="canvas-minimap-close" aria-label={zh ? '关闭画布导航' : 'Close canvas map'} onClick={() => setMinimapOpen(false)}>×</button></div>
          <div className="canvas-minimap-map" aria-label={zh ? '点击节点定位' : 'Click a node to focus'}>
            {minimapViewport && <span className="canvas-minimap-viewport" style={{ left: `${minimapViewport.left / STAGE_SIZE.width * 100}%`, top: `${minimapViewport.top / STAGE_SIZE.height * 100}%`, width: `${minimapViewport.width / STAGE_SIZE.width * 100}%`, height: `${minimapViewport.height / STAGE_SIZE.height * 100}%` }} />}
            {minimapNodes.map(node => {
              const custom = customNodes.find(item => item.id === node.id);
              const label = custom ? CUSTOM_NODE_LABELS[custom.type][zh ? 'zh' : 'en'] : canvasNodeName(node.id as NodeId, zh);
              return <button type="button" key={node.id} className={'canvas-minimap-node ' + (custom ? `is-custom custom-node-${custom.type}` : `is-${node.id}`) + ((selectedNodeId === node.id || selectedCustomNodeId === node.id) ? ' is-selected' : '')} style={{ left: `${node.x / STAGE_SIZE.width * 100}%`, top: `${node.y / STAGE_SIZE.height * 100}%`, width: `${node.width / STAGE_SIZE.width * 100}%`, height: `${node.height / STAGE_SIZE.height * 100}%` }} onClick={() => focusCanvasNode(node.id)} aria-label={zh ? `定位到${label}` : `Focus ${label}`} title={label}><span aria-hidden="true" /></button>;
            })}
          </div>
          <small>{zh ? '点击色块定位节点；拖动和缩放仍在主画布完成。' : 'Click a block to focus a node. Pan and zoom in the main canvas.'}</small>
        </aside>}
        {selectedCanvasImageNode && selectedImageToolbarPosition && <div className="canvas-selected-asset-toolbar" style={{ left: selectedImageToolbarPosition.left, top: selectedImageToolbarPosition.top }} role="toolbar" aria-label={zh ? '图片节点操作' : 'Image node actions'} onPointerDown={event => event.stopPropagation()}>
          <span className="canvas-selected-asset-toolbar-label"><span aria-hidden="true">▧</span><b>{zh ? '图片节点' : 'IMAGE NODE'}</b></span>
          <button type="button" onClick={openSelectedImagePreview} disabled={!customNodePreviewUrls[selectedCanvasImageNode.id]}>{zh ? '高清查看' : 'View HD'}</button>
          <button type="button" onClick={() => void addSelectedImageToReferences()} disabled={!selectedCanvasImageNode.assetId}>{zh ? '加入参考' : 'Add reference'}</button>
          <button type="button" onClick={() => removeCustomNode(selectedCanvasImageNode.id)}>{zh ? '删除' : 'Delete'}</button>
        </div>}
        <div className={'video-canvas-stage ' + (canvasSemantics.shot.collapsed ? 'is-shot-collapsed ' : '') + (customLayoutMode ? 'is-custom-layout-mode' : '')} style={{ width: STAGE_SIZE.width, height: STAGE_SIZE.height, transform: 'translate(' + viewport.x + 'px,' + viewport.y + 'px) scale(' + viewport.scale + ')' }}>
          <div
            className={'canvas-shot-container ' + (canvasSemantics.shot.collapsed ? 'is-collapsed' : '')}
            data-shot-id={canvasSemantics.shot.id}
            data-shot-status={canvasSemantics.shot.status}
            style={{ left: shotFrame.x, top: shotFrame.y, width: shotFrame.width, height: shotFrame.height }}
            aria-label={zh ? `${canvasSemantics.shot.title} 容器` : `${canvasSemantics.shot.title} container`}
          >
            <div className="canvas-shot-container-head" onPointerDown={startShotDrag} onPointerMove={moveShot} onPointerUp={endShotDrag} onPointerCancel={endShotDrag}>
              <span className="canvas-shot-container-index">{String(canvasSemantics.shot.index).padStart(2, '0')}</span>
              <div><b>{zh ? '当前镜头' : 'Current shot'}</b><small>{canvasSemantics.shot.title}</small></div>
              <span className={'canvas-shot-container-status ' + canvasSemantics.shot.status}><i />{canvasSemantics.shot.status === 'generating' ? (zh ? '生成中' : 'Generating') : canvasSemantics.shot.status === 'completed' ? (zh ? '已完成' : 'Completed') : canvasSemantics.shot.status === 'failed' ? (zh ? '需处理' : 'Needs attention') : (zh ? '草稿' : 'Draft')}</span>
              <div className="canvas-shot-container-actions">
                <button type="button" className="canvas-shot-container-action" disabled={shotActionsDisabled} title={shotActionsDisabled ? (zh ? '当前任务完成后可继续创建镜头' : 'Finish the current task before creating another shot') : undefined} onPointerDown={event => event.stopPropagation()} onClick={() => createNextShot(true)}>{zh ? '复制' : 'Duplicate'}</button>
                <button type="button" className="canvas-shot-container-action" disabled={shotActionsDisabled} title={shotActionsDisabled ? (zh ? '当前任务完成后可继续创建镜头' : 'Finish the current task before creating another shot') : undefined} onPointerDown={event => event.stopPropagation()} onClick={() => createNextShot(false)}>{zh ? '+ 新镜头' : '+ New shot'}</button>
                <button type="button" className="canvas-shot-container-action canvas-shot-order-action" disabled={!canMoveCurrentShotUp} title={canMoveCurrentShotUp ? (zh ? '镜头前移' : 'Move shot earlier') : (zh ? '已经是第一个镜头' : 'Already the first shot')} aria-label={zh ? '镜头前移' : 'Move shot earlier'} onPointerDown={event => event.stopPropagation()} onClick={() => reorderCurrentShot('up')}>↑</button>
                <button type="button" className="canvas-shot-container-action canvas-shot-order-action" disabled={!canMoveCurrentShotDown} title={canMoveCurrentShotDown ? (zh ? '镜头后移' : 'Move shot later') : (zh ? '已经是最后一个镜头' : 'Already the last shot')} aria-label={zh ? '镜头后移' : 'Move shot later'} onPointerDown={event => event.stopPropagation()} onClick={() => reorderCurrentShot('down')}>↓</button>
                <button type="button" className="canvas-shot-container-action canvas-shot-delete-action" disabled={shotActionsDisabled || shotRailItems.length <= 1} title={shotRailItems.length <= 1 ? (zh ? '至少保留一个镜头' : 'Keep at least one shot') : (zh ? '从画布删除当前镜头' : 'Remove this shot from the canvas')} aria-label={zh ? '删除当前镜头' : 'Delete current shot'} onPointerDown={event => event.stopPropagation()} onClick={deleteCurrentShot}>{zh ? '删除' : 'Delete'}</button>
                <button type="button" aria-expanded={!canvasSemantics.shot.collapsed} onPointerDown={event => event.stopPropagation()} onClick={toggleShotCollapsed}>{canvasSemantics.shot.collapsed ? (zh ? '展开' : 'Expand') : (zh ? '收起' : 'Collapse')}</button>
              </div>
            </div>
            {!canvasSemantics.shot.collapsed && <div className="canvas-shot-container-flow"><span>{zh ? 'SHOT FLOW' : 'SHOT FLOW'}</span><b>{zh ? '素材 → Agent → 生成 → 结果' : 'Reference → Agent → Generate → Result'}</b></div>}
          </div>
          <svg className="video-canvas-edges" width={STAGE_SIZE.width} height={STAGE_SIZE.height} aria-hidden="true">
            {edges.map(edge => <g key={edge.id} className={customEdges.some(customEdge => customEdge.id === edge.id) ? 'custom-edge' : undefined}><path className="edge-shadow" d={edge.d} /><path d={edge.d} /></g>)}
          </svg>

          <article className={'video-canvas-node source-node ' + (selectedNodeId === 'source' ? 'is-selected' : '')} data-canvas-node="source" data-canvas-role={canvasSemantics.nodes.source?.role} data-shot-id={canvasSemantics.nodes.source?.shotId} data-asset-id={canvasSemantics.nodes.source?.assetId || undefined} data-highlighted-asset={highlightedAssetId || undefined} data-status={canvasSemantics.nodes.source?.status} data-selected={selectedNodeId === 'source' ? 'true' : undefined} onClick={() => setSelectedNodeId('source')} style={{ left: nodes.source.x, top: nodes.source.y, width: nodeSize.source.width, minHeight: nodeSize.source.height }}>
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '镜头边界节点。拖动，或使用方向键移动。' : 'Shot boundary node. Drag it or use the arrow keys to move it.'} onFocus={() => setSelectedNodeId('source')} onKeyDown={event => moveNodeWithKeyboard(event, 'source')} onPointerDown={event => startNodeDrag(event, 'source')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>01</span><b>{zh ? '镜头边界' : 'Shot boundary'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body">
              {referenceMode === 'text' ? <div className="canvas-text-source-node"><span aria-hidden="true">Aa</span><b>{zh ? '纯文本镜头' : 'Text-only shot'}</b><small>{zh ? 'Veo 3.1 Lite 不使用参考图片' : 'Veo 3.1 Lite does not use reference images'}</small></div> : referenceMode === 'start-end' ? <>
                <UploadControl label="START" zh={zh} value={startFrame} busy={uploading === 'start'} onSelect={file => void upload('start', file)} onRemove={() => { retireAsset(startFrame?.assetId); setStartFrame(null); patchSemanticNode('source', { assetId: null }); }} />
                <UploadControl label="END" zh={zh} optional value={endFrame} busy={uploading === 'end'} onSelect={file => void upload('end', file)} onRemove={() => { retireAsset(endFrame?.assetId); setEndFrame(null); if (!startFrame) patchSemanticNode('source', { assetId: null }); }} />
              </> : <div className="canvas-omni-node">
                <div className="canvas-omni-node-head"><b>{zh ? '全能参考' : 'Omni reference'}</b><span>{referenceFrames.length}/9</span></div>
                <div className="canvas-omni-grid">
                  {referenceFrames.map((frame, index) => {
                    const mentionIndex = frameReferenceIndex(frame, index);
                    const binding = referenceBindingForFrame(frame, index, activeReferenceBindings);
                    return <OmniReferenceChip key={frame.assetId} frame={frame} role={binding.role} roleLabel={canvasReferenceRoleLabel(binding.role, zh)} strength={binding.strength} zh={zh} highlighted={highlightedAssetId === frame.assetId} mentionLabel={zh ? `@图片${mentionIndex}` : `@image${mentionIndex}`} loadingLabel={zh ? '读取中' : 'Loading'} removeLabel={zh ? `移除图片 ${mentionIndex}` : `Remove image ${mentionIndex}`} onMention={() => mentionReference(index)} onRemove={() => removeReference(index)} />;
                  })}
                  {referenceFrames.length < 9 && <label className="canvas-omni-add"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { void uploadReferences(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><span>＋</span><b>{uploading === 'reference' ? (zh ? '上传中' : 'Uploading') : (zh ? '加入图片' : 'Add images')}</b></label>}
                </div>
                <small>{zh ? '先在底部设置图片用途，再点击 @图片编号插入提示词。' : 'Set each image’s purpose below, then use its @image label in the prompt.'}</small>
              </div>}
              <div className="canvas-source-actions">
                <button type="button" className="canvas-source-animate-button" disabled={shotActionsDisabled} data-canvas-action="animate" onClick={animateCurrentReference}>{zh ? 'Animate 当前素材' : 'Animate current reference'}<span aria-hidden="true">→</span></button>
                <small>{hasReferenceInput ? (zh ? '进入底部生成台，选择模型后提交。' : 'Open the composer, choose a model, then submit.') : (zh ? '需要至少 1 张参考图。' : 'At least one reference image is required.')}</small>
              </div>
            </div>
              <span className="node-port output" aria-hidden="true" />
              <button type="button" className="canvas-node-add-next" onPointerDown={event => event.stopPropagation()} onClick={() => openNodePaletteFor('source')} aria-label={zh ? '在镜头边界后添加下一步' : 'Add a next step after shot boundary'}>＋</button>
          </article>

          <article className={'video-canvas-node agent-node ' + (selectedNodeId === 'agent' ? 'is-selected' : '')} data-canvas-node="agent" data-canvas-role={canvasSemantics.nodes.agent?.role} data-shot-id={canvasSemantics.nodes.agent?.shotId} data-generation-id={canvasSemantics.nodes.agent?.generationId || undefined} data-status={canvasSemantics.nodes.agent?.status} data-selected={selectedNodeId === 'agent' ? 'true' : undefined} onClick={() => setSelectedNodeId('agent')} style={{ left: nodes.agent.x, top: nodes.agent.y, width: nodeSize.agent.width, minHeight: nodeSize.agent.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? 'Agent 导演节点。拖动，或使用方向键移动。' : 'Agent director node. Drag it or use the arrow keys to move it.'} onFocus={() => setSelectedNodeId('agent')} onKeyDown={event => moveNodeWithKeyboard(event, 'agent')} onPointerDown={event => startNodeDrag(event, 'agent')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>02</span><b>{zh ? 'Agent 导演' : 'Agent director'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-agent-body">
              <div className="canvas-agent-badge"><span aria-hidden="true">✦</span><b>{agentPlan ? agentPlan.director.label : 'GPT / Claude'}</b><small>{agentPlan ? (agentPlan.agentFallback ? (zh ? '规则回退' : 'Rules fallback') : (zh ? '已规划' : 'Planned')) : (zh ? '待规划' : 'Ready')}</small></div>
              {agentPlan ? <>
                <strong>{agentPlan.modelLabel}</strong>
                <p>{agentPlan.reasoning}</p>
                <div className="canvas-agent-explainability" aria-label={zh ? 'Agent 规划说明' : 'Agent plan explanation'}>
                  <div className="canvas-agent-explainability-head"><span>{zh ? '规划依据' : 'PLAN TRACE'}</span><b>{model === 'auto' ? (zh ? '自动模式' : 'Auto mode') : (zh ? '模型已锁定' : 'Model locked')}</b></div>
                  <div className="canvas-agent-plan-facts">
                    <span>{zh ? `时长 ${agentPlan.duration}` : `Duration ${agentPlan.duration}`}</span>
                    <span>{agentPlan.aspectRatio || aspectRatio}</span>
                    <span>{agentPlan.resolution}</span>
                  </div>
                  {activeReferenceBindings.length > 0 && <div className="canvas-agent-reference-list">
                    <small>{zh ? '素材绑定' : 'Bound assets'}</small>
                    {activeReferenceBindings.map(reference => <div className="canvas-agent-reference-row" key={`${reference.mentionId}-${reference.assetId}`}>
                      <b>{reference.token}</b><span>{canvasReferenceRoleLabel(reference.role, zh)}</span><em className={reference.strength}>{reference.strength === 'strong' ? (zh ? '强约束' : 'Strong') : (zh ? '弱参考' : 'Weak')}</em><code>{reference.assetId.slice(0, 14)}…</code>
                    </div>)}
                  </div>}
                  {agentPlan.warnings.length > 0 && <div className="canvas-agent-corrections"><small>{zh ? '校正 / 风险' : 'Corrections / risks'}</small>{agentPlan.warnings.slice(0, 2).map(warning => <span key={warning}>{warning}</span>)}</div>}
                  <small className="canvas-agent-confirmation">{zh ? '规划只读，需你确认后才会提交付费生成任务。' : 'Planning is read-only. Confirm before submitting a paid generation task.'}</small>
                </div>
                {agentPlan.referenceImageRoles && agentPlan.referenceImageRoles.length > 0 && <small className="canvas-agent-confidence">{zh ? `参考图角色：${agentPlan.referenceImageRoles.map(item => item.role).join(' · ')}` : `Reference roles: ${agentPlan.referenceImageRoles.map(item => item.role).join(' · ')}`}</small>}
                {typeof agentPlan.confidence === 'number' && <small className="canvas-agent-confidence">{zh ? `规划置信度 ${Math.round(agentPlan.confidence * 100)}%` : `${Math.round(agentPlan.confidence * 100)}% planning confidence`}</small>}
                {recentCanvasEvents.length > 0 && <div className="canvas-agent-event-log"><small>{zh ? '最近事件' : 'Recent events'}</small>{recentCanvasEvents.slice(0, 3).map(event => <div key={event.id}><i>{event.actor === 'agent' ? '✦' : '•'}</i><span>{canvasEventLabel(event, zh)}</span><time>{formatHistoryTime(event.createdAt, zh)}</time></div>)}</div>}
              </> : <p>{zh ? '理解 Prompt 和参考图，选择 H3 或 Seedance，再交给异步任务。' : 'Read the prompt and references, choose H3 or Seedance, then hand off to the async task.'}</p>}
              <small className="canvas-agent-context" aria-live="polite">{selectedNodeId ? (zh ? `已带入选中节点：${canvasNodeName(selectedNodeId, zh)}` : `Selected node included: ${canvasNodeName(selectedNodeId, zh)}`) : (zh ? '当前镜头上下文会随规划一并发送' : 'Current shot context will be included with the plan')}</small>
              <button type="button" className="canvas-agent-plan-button" disabled={planning} title={agentPlanBlockedReason || undefined} onClick={handleAgentAction}>{planning ? (zh ? '规划中…' : 'Planning…') : prompt.trim() ? (zh ? '根据 Prompt 规划' : 'Plan from prompt') : (zh ? '填写 Prompt' : 'Add Prompt')}</button>
              {agentPlanBlockedReason && <small className="canvas-agent-prerequisite">{agentPlanBlockedReason}</small>}
            </div>
            <span className="node-port output" aria-hidden="true" />
            <button type="button" className="canvas-node-add-next" onPointerDown={event => event.stopPropagation()} onClick={() => openNodePaletteFor('agent')} aria-label={zh ? '在 Agent 导演后添加下一步' : 'Add a next step after Agent director'}>＋</button>
          </article>

          <article className={'video-canvas-node task-node ' + (selectedNodeId === 'task' ? 'is-selected' : '')} data-canvas-node="task" data-canvas-role={canvasSemantics.nodes.task?.role} data-shot-id={canvasSemantics.nodes.task?.shotId} data-generation-id={canvasSemantics.nodes.task?.generationId || undefined} data-version-id={canvasSemantics.nodes.task?.versionId || undefined} data-version={canvasSemantics.nodes.task?.version || undefined} data-best-take={canvasSemantics.nodes.task?.bestTake ? 'true' : undefined} data-status={canvasSemantics.nodes.task?.status} data-selected={selectedNodeId === 'task' ? 'true' : undefined} onClick={() => setSelectedNodeId('task')} style={{ left: nodes.task.x, top: nodes.task.y, width: nodeSize.task.width, minHeight: nodeSize.task.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '视频生成节点。拖动，或使用方向键移动。' : 'Video generation node. Drag it or use the arrow keys to move it.'} onFocus={() => setSelectedNodeId('task')} onKeyDown={event => moveNodeWithKeyboard(event, 'task')} onPointerDown={event => startNodeDrag(event, 'task')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>03</span><b>{zh ? '视频生成' : 'Video generation'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-task-body">
              <div className="canvas-task-model"><span className="canvas-task-model-icon" aria-hidden="true">▣</span><div><b>{modelName(model)}</b><small>{referenceMode === 'text' ? (zh ? '纯文本生视频 · 固定 8 秒' : 'Text-to-video · fixed 8s') : referenceMode === 'omni' ? (zh ? '全能参考 · 最多 9 张' : 'Omni · up to 9 images') : (zh ? '首尾帧参考' : 'Start / end')}</small></div><button type="button" onClick={() => { setTemplateOpen(false); setMinimapOpen(false); setPreferencesOpen(true); }}>{zh ? '设置' : 'Set'}</button></div>
              <div className="canvas-cost"><span>{selectedModel?.ownerUnlimited ? (zh ? '主人积分' : 'Owner credits') : (zh ? '预计消耗' : 'Estimated cost')}</span><b>{selectedModel?.ownerUnlimited ? (zh ? '无限' : 'Unlimited') : estimatedCredits ? estimatedCredits + ' cr' : '—'}</b></div>
              <ul><li className={hasReferenceInput ? 'done' : ''}>{referenceMode === 'text' ? (zh ? '纯文本输入' : 'Text input') : referenceMode === 'omni' ? (zh ? `${referenceFrames.length}/9 参考图片` : `${referenceFrames.length}/9 references`) : (zh ? 'START 图片' : 'START frame')}</li><li className={prompt.trim() ? 'done' : ''}>Motion Prompt</li><li className={selectedModel?.enabled && referenceModeSupported ? 'done' : ''}>{zh ? '模型可用' : 'Model ready'}</li><li className={preflight.ok ? 'done' : ''}>{zh ? '提交前检查' : 'Preflight'}</li></ul>
              <div className={'canvas-task-state ' + (generation?.status || 'draft')}><span />{generation ? statusLabel(generation.status, zh, generation.errorCode) : (zh ? '等待提交' : 'Ready to submit')}</div>
              {!generation && <strong className={'canvas-task-next ' + (canGenerate ? 'ready' : '')}>{canGenerate ? (zh ? '参数已齐，可以生成' : 'Ready to generate') : generationBlockedReason}</strong>}
              <small>{zh ? '在底部生成台补齐参数并提交。仅成功后扣除积分。' : 'Complete the settings in the composer below. Credits settle only on success.'}</small>
            </div>
            <span className="node-port output" aria-hidden="true" />
            <button type="button" className="canvas-node-add-next" onPointerDown={event => event.stopPropagation()} onClick={() => openNodePaletteFor('task')} aria-label={zh ? '在视频生成后添加下一步' : 'Add a next step after video generation'}>＋</button>
          </article>

          <article className={'video-canvas-node result-node ' + (selectedNodeId === 'result' ? 'is-selected' : '')} data-canvas-node="result" data-canvas-role={canvasSemantics.nodes.result?.role} data-shot-id={canvasSemantics.nodes.result?.shotId} data-generation-id={canvasSemantics.nodes.result?.generationId || undefined} data-version-id={canvasSemantics.nodes.result?.versionId || undefined} data-version={canvasSemantics.nodes.result?.version || undefined} data-best-take={canvasSemantics.nodes.result?.bestTake ? 'true' : undefined} data-status={canvasSemantics.nodes.result?.status} data-selected={selectedNodeId === 'result' ? 'true' : undefined} onClick={() => setSelectedNodeId('result')} style={{ left: nodes.result.x, top: nodes.result.y, width: nodeSize.result.width, minHeight: nodeSize.result.height }}>
            <span className="node-port input" aria-hidden="true" />
            <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? '视频结果节点。拖动，或使用方向键移动。' : 'Video result node. Drag it or use the arrow keys to move it.'} onFocus={() => setSelectedNodeId('result')} onKeyDown={event => moveNodeWithKeyboard(event, 'result')} onPointerDown={event => startNodeDrag(event, 'result')} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag}><span>04</span><b>{zh ? '视频结果' : 'Video result'}</b><i>⋮⋮</i></div>
            <div className="canvas-node-body canvas-result-body" aria-live="polite">
              {!generation ? <div className="canvas-result-empty"><span aria-hidden="true">▶</span><b>{zh ? '等待镜头任务' : 'Waiting for a shot'}</b><p>{zh ? '完成左侧节点后，结果和进度会自动出现在这里。' : 'Complete the upstream nodes and the result will appear here.'}</p></div> : <>
                <div className={'canvas-status ' + generation.status} data-time-mode={generationTimeCopy?.mode || undefined}>
                  <b>{statusLabel(generation.status, zh, generation.errorCode)}</b>
                  {generationTimeCopy && <span className="canvas-status-time"><strong>{generationTimeCopy.primary}</strong>{generationTimeCopy.secondary && <small>{generationTimeCopy.secondary}</small>}</span>}
                </div>
                {['queued', 'processing'].includes(generation.status) && <div className="canvas-progress" data-mode={progress > 0 ? 'synced' : 'indeterminate'} aria-hidden="true"><i style={progress > 0 ? { width: Math.max(8, progress) + '%' } : undefined} /></div>}
                {generationInFlight && <button type="button" className="canvas-cancel-button" disabled={cancelling} onClick={() => void cancelGeneration()}>{cancelling ? (zh ? '正在停止…' : 'Stopping…') : (zh ? '停止生成' : 'Stop generation')}<span aria-hidden="true">×</span></button>}
                {videoUrl ? <video src={videoUrl} controls playsInline preload="metadata" /> : generation.status === 'completed' ? <div className="canvas-media-loading">{zh ? '正在读取私有视频…' : 'Loading private video…'}</div> : null}
                {generation.status === 'failed' && <><p className="canvas-failure">{generation.errorMessage || (zh ? '模型未完成本次生成。' : 'The model did not finish this generation.')}</p>{generation.failureStage && <small className="canvas-failure-stage">{zh ? '失败阶段：' : 'Failure stage: '}{failureStageLabel(generation.failureStage, zh)}</small>}</>}
                {generation.status === 'failed' && generation.retryable && <button type="button" className="canvas-retry-button" disabled={!canGenerate || submitting} title={!canGenerate ? generationBlockedReason : undefined} onClick={() => void generate()}>{submitting ? (zh ? '正在重试…' : 'Retrying…') : (zh ? '仅重试此失败任务' : 'Retry this failed task')}</button>}
                {generation.errorCode === 'VIDEO_GENERATION_CANCELLED' && <small className="canvas-cancel-note">{zh ? '可以修改 Motion Prompt 后再次生成。' : 'Edit the Motion Prompt and generate again when ready.'}</small>}
                <dl><div><dt>{zh ? '模型' : 'Model'}</dt><dd>{modelName(generation.model)}</dd></div><div><dt>{zh ? '规格' : 'Format'}</dt><dd>{generation.duration} · {generation.aspectRatio} · {generation.resolution}</dd></div></dl>
                <div className="canvas-result-version"><span>{currentVersion ? `V${currentVersion.number}` : 'V1'}</span>{currentVersion?.bestTake && <b>{zh ? '最佳镜头' : 'BEST TAKE'}</b>}<small>{shotVersions.length > 1 ? (zh ? `${shotVersions.length} 个版本` : `${shotVersions.length} versions`) : (zh ? '首个版本' : 'First version')}</small></div>
                {generation.status === 'completed' && !currentVersion?.bestTake && <button type="button" className="canvas-best-take-button" onClick={() => markBestTake(generation.id)}>{zh ? '设为最佳镜头' : 'Set as Best Take'}</button>}
                {shotVersions.length > 1 && <button type="button" className="canvas-compare-button" onClick={toggleCompare}>{zh ? '对比当前镜头版本' : 'Compare shot versions'}</button>}
                {!['queued', 'processing'].includes(generation.status) && <button type="button" className="canvas-branch-button" disabled={!alternateModelDetails?.enabled} title={!alternateModelDetails?.enabled ? (zh ? `${modelName(alternateModel)} 尚未配置` : `${modelName(alternateModel)} is not configured`) : undefined} onClick={prepareAlternateModel}>{zh ? `用 ${modelName(alternateModel)} 再生成` : `Generate with ${modelName(alternateModel)}`}</button>}
                <div className="canvas-result-actions"><button type="button" disabled={!generation.videoAssetId} onClick={() => void download()}>{zh ? '下载' : 'Download'}</button><button type="button" disabled={!generation.thumbnailAssetId} onClick={() => void continueWithResult()}>{zh ? '设为下一镜头 START' : 'Use as next START'}</button></div>{generation.thumbnailAssetId && <small>{zh ? '下一镜头将使用结果缩略帧作为 START。' : 'The next shot will use the result thumbnail as START.'}</small>}
                {!generation.thumbnailAssetId && generation.status === 'completed' && <small>{zh ? '模型未返回可复用的结果帧；视频仍可下载。' : 'The model did not return a reusable result frame; the video remains downloadable.'}</small>}
              </>}
            </div>
            <button type="button" className="canvas-node-add-next result-add-next" onPointerDown={event => event.stopPropagation()} onClick={() => openNodePaletteFor('result')} aria-label={zh ? '在视频结果后添加下一步' : 'Add a next step after video result'}>＋</button>
              </article>
          {customNodes.map(node => {
            const labels = CUSTOM_NODE_LABELS[node.type];
            return <article key={node.id} className={'video-canvas-node canvas-custom-node custom-node-' + node.type + (selectedCustomNodeId === node.id ? ' is-selected' : '')} data-canvas-node={node.id} data-custom-node="true" data-custom-type={node.type} data-selected={selectedCustomNodeId === node.id ? 'true' : undefined} onClick={() => { setSelectedNodeId(null); setSelectedCustomNodeId(node.id); }} style={{ left: node.x, top: node.y, width: CUSTOM_NODE_SIZE.width, minHeight: CUSTOM_NODE_SIZE.height }}>
              <span className="node-port input" aria-hidden="true" />
              <div className="canvas-node-grip" role="group" tabIndex={0} aria-label={zh ? `${labels.zh}节点。拖动，或使用方向键移动。` : `${labels.en} node. Drag it or use arrow keys to move it.`} onFocus={() => { setSelectedNodeId(null); setSelectedCustomNodeId(node.id); }} onKeyDown={event => moveCustomNodeWithKeyboard(event, node.id)} onPointerDown={event => startCustomNodeDrag(event, node.id)} onPointerMove={moveCustomNode} onPointerUp={endCustomNodeDrag} onPointerCancel={endCustomNodeDrag}><span aria-hidden="true">{labels.icon}</span><b>{zh ? labels.zh : labels.en}</b><i>⋮⋮</i></div>
              <div className="canvas-custom-node-body">
                <div className="canvas-custom-node-kicker">{zh ? '自定义下一步' : 'CUSTOM NEXT STEP'}</div>
                {node.type === 'image' && customNodePreviewUrls[node.id] && <div className="canvas-custom-node-media"><img src={customNodePreviewUrls[node.id]} alt={node.body || (zh ? '图片参考' : 'Image reference')} loading="lazy" decoding="async" /></div>}
                {node.type === 'text' ? <textarea value={node.body} maxLength={1200} aria-label={zh ? '编辑文字节点' : 'Edit text node'} onChange={event => updateCustomNodeBody(node.id, event.target.value)} /> : <p>{node.body || (zh ? labels.hintZh : labels.hintEn)}</p>}
                <small>{node.assetId ? (zh ? '已绑定素材，可继续作为参考。' : 'Asset bound; ready to use as a reference.') : (zh ? labels.hintZh : labels.hintEn)}</small>
              </div>
              <div className="canvas-custom-node-actions"><button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => openNodePaletteFor(node.id)} aria-label={zh ? `在${labels.zh}后添加下一步` : `Add a next step after ${labels.en}`}>＋</button><button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => removeCustomNode(node.id)} aria-label={zh ? `删除${labels.zh}节点` : `Delete ${labels.en} node`}>×</button></div>
              <span className="node-port output" aria-hidden="true" />
            </article>;
          })}
            </div>
          </div>

      {nodePaletteOpen && <aside id="canvas-node-palette" className="canvas-node-palette" role="region" aria-labelledby="canvas-node-palette-title" onKeyDown={event => { if (event.key === 'Escape') closeNodePalette(); }}>
        <div className="canvas-node-palette-head"><div><span>{nodePaletteParentId ? (zh ? '连接下一步' : 'CONNECT NEXT STEP') : (zh ? '工作区工具' : 'WORKSPACE TOOLS')}</span><b id="canvas-node-palette-title">{nodePaletteParentId ? (zh ? `接到「${paletteParentName}」` : `Connect after ${paletteParentName}`) : (zh ? '添加节点' : 'Add a node')}</b><small>{nodePaletteParentId ? (zh ? '选择文字、图片、视频或其他；只添加画布步骤，不会自动提交生成。' : 'Choose text, image, video, or other. This only adds a canvas step; it never submits a task.') : (zh ? '把输入素材放进当前镜头。' : 'Bring an input into the current shot.')}</small></div><button type="button" className="canvas-node-palette-close" aria-label={zh ? '关闭添加节点面板' : 'Close add node panel'} onClick={closeNodePalette}>×</button></div>
        <div className="canvas-node-palette-section"><span>{zh ? '节点' : 'NODES'}</span><div className="canvas-node-palette-grid">
          <button type="button" className="canvas-node-palette-item" onClick={addTextNode}><span aria-hidden="true">≡</span><b>{zh ? '文本' : 'Text'}</b><small>{zh ? '写 Motion Prompt' : 'Write a motion prompt'}</small></button>
          <label className="canvas-node-palette-item"><input ref={paletteImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { void handlePaletteImage(file); closeNodePalette(); } event.currentTarget.value = ''; }} /><span aria-hidden="true">▧</span><b>{zh ? '图片' : 'Image'}</b><small>{nodePaletteParentId ? (zh ? '添加图片步骤' : 'Add an image step') : (zh ? '加入 START / 参考图' : 'Add START / reference')}</small></label>
          <button type="button" className="canvas-node-palette-item" onClick={addVideoNode}><span aria-hidden="true">▣</span><b>{zh ? '视频' : 'Video'}</b><em className="canvas-node-palette-badge">{selectedModel?.enabled ? modelName(model) : (zh ? '选择模型' : 'Choose model')}</em><small>{zh ? '选择模型并写动作提示' : 'Choose a model and prompt'}</small></button>
          <button type="button" className="canvas-node-palette-item" onClick={addOtherNode}><span aria-hidden="true">✦</span><b>{zh ? '其他' : 'Other'}</b><small>{zh ? '自定义步骤或素材说明' : 'Custom step or asset note'}</small></button>
        </div></div>
        <div className="canvas-node-palette-section"><span>{zh ? '素材' : 'ASSETS'}</span><div className="canvas-node-palette-list">
          <label className="canvas-node-palette-row"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { void handlePaletteImage(file); closeNodePalette(); } event.currentTarget.value = ''; }} /><span aria-hidden="true">↥</span><div><b>{zh ? '本地上传' : 'Local upload'}</b><small>{zh ? '从设备加入图片素材' : 'Add an image from this device'}</small></div></label>
          <button type="button" className="canvas-node-palette-row" onClick={addReferenceNode}><span aria-hidden="true">@</span><div><b>{zh ? '引用参考' : 'Reference set'}</b><small>{zh ? '切换到最多 9 张全能参考' : 'Switch to up to 9 omni references'}</small></div></button>
        </div></div>
      </aside>}

      {historyOpen && <aside id="canvas-history-panel" className="canvas-history-panel" role="region" aria-labelledby="canvas-history-title" onKeyDown={event => { if (event.key === 'Escape') setHistoryOpen(false); }}>
        <div className="canvas-history-head">
          <div><span>{zh ? '任务档案' : 'TASK ARCHIVE'}</span><b id="canvas-history-title">{zh ? '生成历史' : 'Generation history'}</b><small>{zh ? '当前 Team 账号的最近任务' : 'Recent tasks for this Team account'}</small></div>
          <button type="button" className="canvas-history-close" aria-label={zh ? '关闭生成历史' : 'Close generation history'} onClick={() => setHistoryOpen(false)}>×</button>
        </div>
        {historyLoading ? <p className="canvas-history-state">{zh ? '正在读取历史任务…' : 'Loading generation history…'}</p> : historyError ? <div className="canvas-history-error"><p>{historyError}</p><button type="button" onClick={() => void loadHistoryPage(false)}>{zh ? '重试' : 'Retry'}</button></div> : history.length ? <div className="canvas-history-list">{history.map(item => <button type="button" className={'canvas-history-row ' + (generation?.id === item.id ? 'is-current' : '')} key={item.id} onClick={() => void restoreHistoryItem(item)}><span className="canvas-history-status" data-status={item.status} aria-hidden="true" /><span className="canvas-history-row-copy"><b>{item.prompt || (zh ? '未命名镜头' : 'Untitled shot')}</b><small>{[historyShotLabel(item, zh), modelName(item.model), item.duration, formatHistoryTime(item.createdAt, zh)].filter(Boolean).join(' · ')}</small></span><span className="canvas-history-row-meta"><strong>{statusLabel(item.status, zh, item.errorCode)}</strong><small>{item.creditsCost ? item.creditsCost + ' cr' : (zh ? '主人无限' : 'Owner')}</small></span></button>)}</div> : <div className="canvas-history-empty"><span aria-hidden="true">✦</span><p>{zh ? '还没有生成任务。' : 'No generation tasks yet.'}</p><small>{zh ? '提交第一条镜头后，它会自动出现在这里。' : 'Your first submitted shot will appear here.'}</small></div>}
        {history.length > 0 && historyHasMore && <button type="button" className="canvas-history-more" disabled={historyLoadingMore} onClick={() => void loadHistoryPage(true)}>{historyLoadingMore ? (zh ? '正在加载…' : 'Loading…') : (zh ? '加载更多' : 'Load more')}</button>}
        <p className="canvas-history-footnote">{zh ? '点击任务可载入当前画布；不会重新提交模型。' : 'Select a task to load it here; no model request is submitted.'}</p>
      </aside>}

      {compareOpen && <aside id="canvas-compare-panel" className="canvas-compare-panel" role="region" aria-labelledby="canvas-compare-title" onKeyDown={event => { if (event.key === 'Escape') setCompareOpen(false); }}>
        <div className="canvas-history-head">
          <div><span>{zh ? '版本分支' : 'VERSION BRANCHES'}</span><b id="canvas-compare-title">{zh ? '对比当前镜头' : 'Compare this shot'}</b><small>{zh ? '同一镜头的生成结果与最佳镜头' : 'Generations and Best Take for the active shot'}</small></div>
          <button type="button" className="canvas-history-close" aria-label={zh ? '关闭版本对比' : 'Close version comparison'} onClick={() => setCompareOpen(false)}>×</button>
        </div>
        <div className="canvas-compare-list">
          {shotVersions.map(({ version, generation: item }) => <article className={'canvas-compare-card ' + (generation?.id === version.generationId ? 'is-current' : '')} key={version.id}>
            <div className="canvas-compare-card-head"><b>V{version.number}</b>{version.bestTake && <strong>{zh ? '最佳镜头' : 'BEST TAKE'}</strong>}<span>{item ? statusLabel(item.status, zh, item.errorCode) : (zh ? '历史任务' : 'History')}</span></div>
            {item?.status === 'completed' && <div className="canvas-compare-preview" aria-label={zh ? `版本 V${version.number} 视频预览` : `Video preview for version V${version.number}`}>
              {comparePreviewUrls[item.id] ? <video src={comparePreviewUrls[item.id]} controls playsInline preload="metadata" /> : <span>{comparePreviewLoading ? (zh ? '正在读取预览…' : 'Loading preview…') : comparePreviewError ? (zh ? '预览暂时不可用' : 'Preview unavailable') : (zh ? '等待视频地址…' : 'Waiting for video URL…')}</span>}
            </div>}
            <p>{item?.prompt || (zh ? '历史任务详情将在载入后显示。' : 'Load this task to view its full prompt.')}</p>
            <small>{item ? `${modelName(item.model)} · ${item.duration} · ${formatHistoryTime(item.createdAt, zh)}` : version.generationId}</small>
            <div className="canvas-compare-card-actions">
              {item && generation?.id !== item.id && <button type="button" onClick={() => void selectGenerationAsCurrent(item)}>{zh ? '采用此结果' : 'Use this result'}</button>}
              {item?.status === 'completed' && !version.bestTake && <button type="button" className="is-primary" onClick={() => markBestTake(version.generationId)}>{zh ? '设为最佳' : 'Set best'}</button>}
              {generation?.id === item?.id && <span>{zh ? '当前显示' : 'Currently shown'}</span>}
            </div>
          </article>)}
        </div>
        <p className="canvas-history-footnote">{zh ? '版本只改变当前镜头的选择状态，不会重新提交或重复扣费。' : 'Version selection never resubmits a task or charges credits again.'}</p>
      </aside>}

      <section className={'video-canvas-composer ' + (composerCollapsed ? 'is-composer-collapsed ' : '') + (customLayoutMode ? 'is-layout-mode' : '')} aria-label={zh ? '视频生成控制台' : 'Video generation composer'}>
          <div className="canvas-composer-toolbar">
            <div className="canvas-composer-toolbar-copy"><span>{zh ? `镜头 ${String(shot).padStart(2, '0')} · 生成台` : `SHOT ${String(shot).padStart(2, '0')} · GENERATOR`}</span><b>{generationInFlight ? (zh ? '任务进行中' : 'Task in progress') : composerCollapsed ? (zh ? '已折叠，参数仍保留' : 'Collapsed · settings retained') : (zh ? '参数与素材' : 'Inputs and settings')}</b></div>
            <div className="canvas-composer-toolbar-actions">
              <button type="button" className={'canvas-composer-arrange-button ' + (customLayoutMode ? 'is-active' : '')} aria-pressed={customLayoutMode} onClick={toggleCustomLayoutMode}><span aria-hidden="true">⌘</span>{customLayoutMode ? (zh ? '完成排列' : 'Finish layout') : (zh ? '自定义排列' : 'Custom layout')}</button>
              <button type="button" className="canvas-composer-collapse-button" aria-expanded={!composerCollapsed} aria-controls="canvas-composer-content" onClick={() => setComposerCollapsed(current => !current)}>{composerCollapsed ? (zh ? '展开生成台' : 'Expand composer') : (zh ? '折叠' : 'Collapse')}<span aria-hidden="true">{composerCollapsed ? '⌃' : '⌄'}</span></button>
            </div>
          </div>
          {customLayoutMode && <div className="canvas-composer-arrange-note"><span aria-hidden="true">↗</span><small>{zh ? '拖动画布中的节点自定义排列，位置会自动保存到当前设备。' : 'Drag nodes on the canvas to arrange your workflow. Positions save on this device.'}</small><button type="button" onClick={organizeCanvas}>{zh ? '回到默认流程' : 'Restore default flow'}</button></div>}
          {!composerCollapsed && <>
          <div id={!composerCollapsed ? 'canvas-composer-content' : undefined} className={'canvas-composer-media ' + (referenceMode === 'omni' ? 'is-omni' : '') + (referenceMode === 'text' ? ' is-text' : '')} aria-label={zh ? '参考图片' : 'Reference images'}>
            {referenceMode === 'text' ? <div className="canvas-text-mode-note"><span aria-hidden="true">Aa</span><div><b>{zh ? 'Veo 3.1 Lite 纯文本模式' : 'Veo 3.1 Lite text mode'}</b><small>{zh ? '只提交 Prompt；START、END 和参考图不会上传或发送给模型。' : 'Only the Prompt is submitted; START, END, and reference images are not uploaded or sent to the model.'}</small></div></div> : referenceMode === 'start-end' ? <>
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
              {referenceFrames.map((frame, index) => {
                const mentionIndex = frameReferenceIndex(frame, index);
                const binding = referenceBindingForFrame(frame, index, activeReferenceBindings);
                return <OmniReferenceChip key={frame.assetId} frame={frame} role={binding.role} roleLabel={canvasReferenceRoleLabel(binding.role, zh)} strength={binding.strength} zh={zh} roleOptions={omniReferenceRoleOptions} editable onRoleChange={nextRole => updateReferenceRole(index, nextRole)} onStrengthChange={() => toggleReferenceStrength(index)} onExtractText={() => void extractScript(frame)} extractingText={scriptOcr.status === 'processing' && scriptOcr.assetId === frame.assetId} extractTextLabel={zh ? `提取 ${mentionIndex} 的脚本文字` : `Extract text from ${mentionIndex}`} highlighted={highlightedAssetId === frame.assetId} mentionLabel={zh ? `@图片${mentionIndex}` : `@image${mentionIndex}`} loadingLabel={zh ? '读取中' : 'Loading'} removeLabel={zh ? `移除图片 ${mentionIndex}` : `Remove image ${mentionIndex}`} onMention={() => mentionReference(index)} onRemove={() => removeReference(index)} />;
              })}
              {referenceFrames.length < 9 && <label className="canvas-reference-chip canvas-omni-composer-add"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={event => { void uploadReferences(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><span aria-hidden="true">＋</span><b>{zh ? '参考图' : 'Reference'}</b><small>{referenceFrames.length}/9</small></label>}
            </>}
          </div>

          <div className="canvas-composer-main">
            <div className="canvas-composer-prompt">
              <div className="canvas-composer-prompt-head"><label htmlFor="canvas-motion-prompt">Motion Prompt</label><div className="canvas-composer-prompt-head-actions">{referenceMode !== 'text' && <label className="canvas-prompt-add-reference" title={zh ? '添加参考素材' : 'Add reference assets'}><input ref={promptReferenceInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading) || referenceFrames.length >= 9} onChange={event => { addPromptReferences(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><span aria-hidden="true">＋</span><b>{zh ? '参考素材' : 'References'}</b></label>}<small>{prompt.trim() ? (zh ? '已填写' : 'Ready') : (zh ? '必需' : 'Required')}</small></div></div>
              <div className="canvas-prompt-input-wrap">
                {promptMentionChips.length > 0 && <div className="canvas-prompt-mention-strip" aria-label={zh ? 'Prompt 中已引用的素材' : 'Assets referenced in the prompt'}>
                  <span className="canvas-prompt-mention-strip-label">{zh ? '已引用' : 'REFERENCES'}</span>
                  <div className="canvas-prompt-mention-chips">
                    {promptMentionChips.map(chip => {
                      const label = `@${zh ? '图片' : 'image'}${chip.index}`;
                      const roleLabel = canvasReferenceRoleLabel(chip.role, zh);
                      const invalid = chip.status !== 'valid';
                      return <button type="button" key={`${chip.mentionId}-${chip.start}`} className={'canvas-prompt-mention-chip ' + (invalid ? 'is-invalid' : '')} onClick={() => focusPromptMention(chip)} title={invalid ? (zh ? '素材未绑定或已失效' : 'Asset is unbound or unavailable') : (zh ? '定位到画布素材' : 'Focus this asset on the canvas')}>
                        {chip.frame?.previewUrl ? <img src={chip.frame.previewUrl} alt="" /> : <span className="canvas-prompt-mention-placeholder" aria-hidden="true">@</span>}
                        <span><b>{label}</b><small>{invalid ? (zh ? '未绑定' : 'Unbound') : roleLabel}</small></span>
                      </button>;
                    })}
                  </div>
                </div>}
                <textarea
                  ref={promptRef}
                  id="canvas-motion-prompt"
                  value={prompt}
                  maxLength={1200}
                  rows={2}
                  aria-autocomplete="list"
                  aria-controls={mentionMenuOpen && filteredMentionCandidates.length > 0 ? 'canvas-mention-menu' : undefined}
                  aria-haspopup="listbox"
                  aria-activedescendant={mentionMenuOpen && filteredMentionCandidates.length > 0 ? `canvas-mention-option-${mentionActiveIndex}` : undefined}
                  onChange={event => { setPrompt(event.target.value); setAgentPlan(null); syncMentionMenu(event.target.value, event.target.selectionStart ?? event.target.value.length); }}
                  onSelect={event => syncMentionMenu(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                  onClick={event => syncMentionMenu(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                  onKeyDown={handlePromptKeyDown}
                  onBlur={() => { window.setTimeout(() => { if (document.activeElement !== promptRef.current) closeMentionMenu(); }, 0); }}
                  placeholder={referenceMode === 'text' ? (zh ? '描述主体、动作、镜头、节奏和声音；Veo 3.1 Lite 将只使用这段文字…' : 'Describe the subject, motion, camera, pacing, and sound; Veo 3.1 Lite will use only this text…') : (zh ? '写清人物、脚本、动作和镜头；输入 @ 选择参考图…' : 'Describe the subject, script, motion, and camera; type @ to pick a reference…')}
                />
                {mentionMenuOpen && filteredMentionCandidates.length > 0 && <div id="canvas-mention-menu" className="canvas-mention-menu" role="listbox" aria-label={zh ? '选择素材引用' : 'Choose an asset reference'}>
                  <div className="canvas-mention-menu-head"><span>{zh ? '插入素材引用' : 'INSERT ASSET REFERENCE'}</span><small>{zh ? '↑↓ 选择 · Enter 插入' : '↑↓ choose · Enter insert'}</small></div>
                  <div className="canvas-mention-menu-list">
                    {filteredMentionCandidates.map((candidate, index) => {
                      const active = index === mentionActiveIndex;
                      const roleLabel = canvasReferenceRoleLabel(candidate.role, zh);
                      return <button
                        type="button"
                        role="option"
                        id={`canvas-mention-option-${index}`}
                        aria-selected={active}
                        className={'canvas-mention-option ' + (active ? 'is-active' : '')}
                        key={`${candidate.frame.assetId}-${candidate.token}`}
                        onMouseDown={event => { event.preventDefault(); chooseMentionCandidate(candidate); }}
                        onMouseEnter={() => setMentionActiveIndex(index)}
                      >
                        {candidate.frame.previewUrl ? <img src={candidate.frame.previewUrl} alt="" /> : <span className="canvas-mention-option-placeholder" aria-hidden="true">＋</span>}
                        <span><b>{candidate.token}</b><small>{roleLabel} · {candidate.frame.name}</small></span>
                        <em>{zh ? '绑定' : 'Bound'}</em>
                      </button>;
                    })}
                  </div>
                </div>}
              </div>
              <span className="canvas-composer-count">{prompt.length}/1200</span>
              {assetMentionValidation.hasInvalid && <p className="canvas-asset-reference-warning" role="alert">{assetMentionValidation.unbound.length > 0
                ? (zh ? `有 ${assetMentionValidation.unbound.length} 个 @图片引用尚未绑定，请点击对应参考图的引用按钮。` : `${assetMentionValidation.unbound.length} image mention${assetMentionValidation.unbound.length > 1 ? 's are' : ' is'} not bound. Click the matching reference chip to bind it.`)
                : (zh ? '提示词里有已失效的素材引用，请重新加入或重新绑定。' : 'A referenced asset is no longer available. Add it again or rebind the mention.')}</p>}
              {scriptReferenceFrames.length > 0 && <div className="canvas-script-ocr-entry" aria-live="polite">
                <div><span className="canvas-script-ocr-icon" aria-hidden="true">Aa</span><div><b>{zh ? '脚本截图可提取文字' : 'Script screenshot text is available'}</b><small>{zh ? '先确认识别结果，再插入 Prompt；会调用视觉模型但不会自动提交视频任务。' : 'Review it before inserting. Vision usage may apply, but no video task is submitted automatically.'}</small></div></div>
                <button type="button" disabled={scriptOcr.status === 'processing'} onClick={() => void extractScript(scriptReferenceFrames[0].frame)}>{scriptOcr.status === 'processing' ? (zh ? '识别中…' : 'Reading…') : (zh ? '提取文字' : 'Extract text')}</button>
              </div>}
              {scriptOcr.status !== 'idle' && scriptOcr.assetId && scriptReferenceFrames.some(item => item.frame.assetId === scriptOcr.assetId) && <div className={'canvas-script-ocr-panel ' + (scriptOcr.status === 'error' ? 'has-error' : '')} aria-label={zh ? '脚本文字识别结果' : 'Script OCR result'}>
                <div className="canvas-script-ocr-panel-head"><div><span>{zh ? '识别结果 · 可编辑' : 'TRANSCRIPTION · EDITABLE'}</span><b>{scriptOcr.status === 'processing' ? (zh ? '正在读取脚本截图…' : 'Reading the script screenshot…') : scriptOcr.status === 'error' ? (zh ? '识别未完成' : 'Could not read the screenshot') : (zh ? '请确认后插入' : 'Review before inserting')}</b></div><small>{scriptOcr.result?.model || SCRIPT_OCR_MODEL_LABEL}</small></div>
                {scriptOcr.status === 'processing' ? <div className="canvas-script-ocr-loading"><i /><span>{zh ? '正在按阅读顺序提取文字，通常需要几秒。' : 'Transcribing the reading order. This usually takes a few seconds.'}</span></div> : <textarea aria-label={zh ? '可编辑的脚本文字' : 'Editable script text'} value={scriptOcr.text} onChange={event => updateScriptOcrText(event.target.value)} rows={5} maxLength={12000} placeholder={zh ? '识别结果会显示在这里，也可以手动粘贴或修正。' : 'The transcription appears here. You can paste or correct it manually.'} />}
                {scriptOcr.error && <p className="canvas-script-ocr-error" role="alert">{scriptOcr.error}</p>}
                {scriptOcr.status !== 'processing' && <div className="canvas-script-ocr-actions"><button type="button" disabled={!scriptOcr.text.trim()} onClick={insertScriptOcr}>{zh ? '插入 Motion Prompt' : 'Insert into Motion Prompt'}</button><button type="button" className="is-quiet" onClick={() => { const source = scriptReferenceFrames.find(item => item.frame.assetId === scriptOcr.assetId); if (source) void extractScript(source.frame); }}>{zh ? '重新识别' : 'Run again'}</button></div>}
              </div>}
            </div>
            <div className="canvas-composer-controls">
              <div className="canvas-template-wrap">
                <button type="button" className={'canvas-template-trigger ' + (templateOpen ? 'is-open' : '')} aria-expanded={templateOpen} aria-controls="canvas-template-panel" onClick={toggleTemplatePicker}>
                  <span className="canvas-template-trigger-icon" aria-hidden="true">✦</span>
                  <span className="canvas-template-trigger-copy"><b>{zh ? '商业模板' : 'Shot templates'}</b><small>{zh ? 'Prompt + 参数预设' : 'Prompt + settings presets'}</small></span>
                  <span className="canvas-template-trigger-arrow" aria-hidden="true">{templateOpen ? '⌃' : '⌄'}</span>
                </button>
                {templateOpen && <div id="canvas-template-panel" className="canvas-template-panel" role="dialog" aria-labelledby="canvas-template-title">
                  <div className="canvas-template-head"><div><span>{zh ? '可复用起点' : 'REUSABLE STARTING POINTS'}</span><b id="canvas-template-title">{zh ? '选择一个镜头模板' : 'Choose a shot template'}</b></div><button type="button" className="canvas-template-close" aria-label={zh ? '关闭模板' : 'Close templates'} onClick={() => setTemplateOpen(false)}>×</button></div>
                  <p className="canvas-template-note">{zh ? '模板只填入草稿，不会提交任务；当前锁定的模型会保留。' : 'Templates only update the draft. No task is submitted and the locked model stays selected.'}</p>
                  <div className="canvas-template-list">
                    {CANVAS_TEMPLATES.map(template => <button type="button" className="canvas-template-card" key={template.id} onClick={() => applyCanvasTemplate(template)}>
                      <span className="canvas-template-card-copy"><b>{zh ? template.labelZh : template.labelEn}</b><small>{zh ? template.descriptionZh : template.descriptionEn}</small><em>{(zh ? template.tagsZh : template.tagsEn).join(' · ')}</em></span>
                      <span className="canvas-template-card-meta"><strong>{zh ? '推荐' : 'Best with'} {modelName(template.recommendedModel)}</strong><small>{template.duration} · {template.aspectRatio} · {template.resolution}</small></span>
                    </button>)}
                  </div>
                </div>}
              </div>
              <div className="canvas-preferences-wrap">
                <button
                  type="button"
                  className={'canvas-preferences-trigger ' + (preferencesOpen ? 'is-open' : '')}
                  aria-expanded={preferencesOpen}
                  aria-controls="canvas-preferences-panel"
                  onClick={() => setPreferencesOpen(current => { const next = !current; if (next) { setTemplateOpen(false); setMinimapOpen(false); } return next; })}
                >
                  <span className="canvas-preferences-trigger-icon" aria-hidden="true">☷</span>
                  <span className="canvas-preferences-trigger-copy">
                    <b>{zh ? '生成偏好' : 'Preferences'}</b>
                    <small>{modelName(model)} · {referenceMode === 'text' ? (zh ? '纯文本' : 'Text-only') : referenceMode === 'omni' ? (zh ? '全能参考' : 'Omni') : (zh ? '首尾帧' : 'Start / end')} · {aspectRatio}</small>
                  </span>
                  <span className="canvas-preferences-trigger-arrow" aria-hidden="true">{preferencesOpen ? '⌃' : '⌄'}</span>
                </button>
                {preferencesOpen && <div id="canvas-preferences-panel" className="canvas-preferences-panel" role="region" aria-labelledby="canvas-preferences-title" onKeyDown={event => { if (event.key === 'Escape') setPreferencesOpen(false); }}>
                  <div className="canvas-preferences-head">
                    <div><span>{zh ? '生成偏好' : 'Generation preferences'}</span><b id="canvas-preferences-title">{zh ? '把这一镜头的参数收在一起' : 'Keep this shot’s settings together'}</b></div>
                    <button type="button" className="canvas-preferences-close" aria-label={zh ? '关闭生成偏好' : 'Close generation preferences'} onClick={() => setPreferencesOpen(false)}>×</button>
                  </div>
                  <div className="canvas-preferences-auto">
                    <div><b>{zh ? '智能推荐' : 'Auto recommend'}</b><small>{routingResult.recommendedModel ? (zh ? `推荐 ${modelName(routingResult.recommendedModel)} · ${routingResult.score} 分` : `Recommends ${modelName(routingResult.recommendedModel)} · ${routingResult.score}`) : (zh ? '当前镜头暂无可用模型' : 'No eligible model for this shot')}</small></div>
                    <select value={routingStrategy} aria-label={zh ? '模型路由策略' : 'Model routing strategy'} onChange={event => setRoutingStrategy(event.target.value as ModelRoutingStrategy)}><option value="BALANCED">{zh ? '均衡' : 'Balanced'}</option><option value="COST">{zh ? '成本优先' : 'Cost first'}</option><option value="QUALITY">{zh ? '质量优先' : 'Quality first'}</option></select>
                  </div>
                  {model === 'auto' && <div className="canvas-router-summary"><strong>{zh ? '本镜头推荐' : 'Recommended for this shot'}：{routingResult.recommendedModel ? modelName(routingResult.recommendedModel) : '—'}</strong><p>{routingResult.reason.slice(0, 3).join(' · ')}</p><div>{routingResult.alternatives.slice(0, 3).map(item => <span key={item.modelId}>{modelName(item.modelId as VideoModelId)} {item.score}</span>)}</div></div>}
                  <div className="canvas-preferences-grid">
                    <label className="canvas-preference-field canvas-preference-field-wide"><span>{zh ? '模型模式' : 'Model mode'}</span><select value={model} onChange={event => selectModel(event.target.value as VideoModelId)}><option value="auto">Auto · {zh ? '智能推荐' : 'Smart routing'}</option>{models.filter(item => item.id !== 'auto').map(item => <option key={item.id} value={item.id}>{modelName(item.id)}{item.enabled ? '' : ' · ' + (zh ? '未就绪' : 'Not ready')}</option>)}</select></label>
                    <fieldset className="canvas-preference-field canvas-preference-compare-field"><legend>{zh ? 'Compare Models · 最多 3 个' : 'Compare models · up to 3'}</legend><div className="canvas-compare-model-options">{models.filter(item => item.id !== 'auto').map(item => {
                      const candidate = item.id as Exclude<VideoModelId, 'auto'>;
                      const eligible = compareModelIsEligible(candidate);
                      return <label key={item.id} title={!eligible ? (zh ? '当前参考模式、分辨率或时长不兼容' : 'Reference mode, resolution, or duration is incompatible') : undefined}><input type="checkbox" checked={compareModels.includes(candidate)} disabled={!item.enabled || !eligible} onChange={() => setCompareModels(current => current.includes(candidate) ? current.filter(value => value !== candidate) : current.length < 3 ? [...current, candidate] : current)} /><span>{modelName(candidate)}</span></label>;
                    })}</div><small>{zh ? '使用完全相同的 Prompt、START/END、参考素材和规格；不会覆盖原结果。' : 'Uses the same prompt, START/END, references, and settings; existing results stay intact.'}</small></fieldset>
                    <label className="canvas-preference-field canvas-preference-field-wide"><span>{zh ? '参考模式' : 'Reference mode'}</span><select value={referenceMode} onChange={event => changeReferenceMode(event.target.value as ReferenceMode)}><option value="start-end">{zh ? '首尾帧参考' : 'Start / end'}</option><option value="omni">{zh ? '全能参考 · 多图' : 'Omni · multi-image'}</option>{(model === 'veo-3.1-lite' || model === 'auto') && <option value="text">{zh ? '纯文本 · Veo Lite' : 'Text-only · Veo Lite'}</option>}</select></label>
                    <fieldset className="canvas-preference-field canvas-preference-ratio-field"><legend>{zh ? '画幅' : 'Aspect ratio'}</legend><div className="canvas-preference-ratios">{ASPECT_RATIO_OPTIONS.map(option => {
                      const disabled = (model === 'minimax-h3' && referenceMode !== 'omni') || ((model === 'veo-3.1-lite' || referenceMode === 'text') && option.value === '1:1');
                      return <button key={option.value} type="button" className={'canvas-ratio-option ' + (aspectRatio === option.value ? 'is-selected ' : '') + option.className} aria-pressed={aspectRatio === option.value} disabled={disabled} onClick={() => setAspectRatio(option.value)}><span className="canvas-ratio-icon" aria-hidden="true" /><b>{option.label}</b></button>;
                    })}</div></fieldset>
                    <label className="canvas-preference-field"><span>{zh ? '分辨率' : 'Resolution'}</span><select value={resolution} onChange={event => setResolution(event.target.value)}>{resolutionOptions.map(value => <option key={value}>{value}</option>)}</select></label>
                    <label className="canvas-preference-field"><span>{zh ? '时长' : 'Duration'}</span><select value={duration} onChange={event => setDuration(event.target.value)}>{videoDurationOptions(settingsModel).map(value => <option key={value}>{value}</option>)}</select></label>
                  </div>
                  <div className="canvas-preferences-footer"><span>{zh ? '生成数量' : 'Outputs'}</span><b>1 <small>{zh ? '当前单条生成' : 'single output for now'}</small></b><em>{zh ? '设置会自动保存到本地' : 'Settings save locally'}</em></div>
                </div>}
              </div>
              <div className="canvas-composer-cost"><small>{zh ? '预计积分' : 'Credits'}</small><b>{selectedModel?.ownerUnlimited ? '∞' : estimatedCredits || '—'}</b></div>
              <button type="button" className="canvas-agent-inline-button" disabled={planning} title={agentPlanBlockedReason || undefined} onClick={handleAgentAction}>{planning ? (zh ? '规划中…' : 'Planning…') : prompt.trim() ? (zh ? 'Agent 规划' : 'Agent plan') : (zh ? '填写 Prompt' : 'Add Prompt')}</button>
              {generationInFlight ? <button type="button" className="canvas-composer-cancel" disabled={cancelling} onClick={() => void cancelGeneration()}>{cancelling ? (zh ? '正在停止…' : 'Stopping…') : (zh ? '停止生成' : 'Stop generation')}<span aria-hidden="true">×</span></button> : <>{compareModels.length >= 2 && <button type="button" className="canvas-compare-submit" disabled={!canCompare} title={!canCompare ? (zh ? '选择 2–3 个已就绪且兼容当前规格的模型' : 'Choose 2–3 ready models compatible with the current settings') : undefined} onClick={() => void compareGenerate()}>{submitting ? (zh ? '对比提交中…' : 'Submitting compare…') : (zh ? `对比生成 ${compareModels.length}` : `Compare ${compareModels.length}`)}</button>}<button type="button" className="canvas-composer-generate" disabled={!canGenerate} title={generationBlockedReason || undefined} onClick={() => void generate()}>{submitting ? <><span className="canvas-submit-spinner" aria-hidden="true" />{zh ? '提交中' : 'Submitting'}</> : <>{zh ? '生成视频' : 'Generate video'}<span aria-hidden="true">→</span></>}</button></>}
            </div>
            <div className={'canvas-preflight-review ' + (preflight.ok ? 'is-ready' : 'has-errors')} role="status" aria-live="polite">
              <div className="canvas-preflight-review-head"><span>{zh ? '提交前检查' : 'PREFLIGHT REVIEW'}</span><b>{preflight.ok ? (zh ? '可以提交' : 'Ready to submit') : (zh ? `${preflight.errors.length} 项需要处理` : `${preflight.errors.length} item${preflight.errors.length > 1 ? 's need' : ' needs'} attention`)}</b></div>
              {(preflight.errors.length > 0 || preflight.warnings.length > 0) && <ul>{[...preflight.errors, ...preflight.warnings].slice(0, 3).map(issue => <li key={issue.code} className={issue.severity}><i />{issue.message}</li>)}</ul>}
              {preflight.ok && preflight.warnings.length === 0 && <small>{zh ? '素材、模型能力和参数均已检查。' : 'Assets, model capability, and settings passed the checks.'}</small>}
            </div>
            {agentPlan && <div className="canvas-agent-plan-result" aria-live="polite">
              <div><b>{agentPlan.agentFallback ? (zh ? '规则规划已接管' : 'Rules fallback is active') : (zh ? 'Agent 已生成方案' : 'Agent plan ready')}</b><span>{agentPlan.director.label} · {agentPlan.director.model} · {agentPlan.modelLabel} · {agentPlan.duration}{typeof agentPlan.confidence === 'number' ? ` · ${Math.round(agentPlan.confidence * 100)}%` : ''}</span></div>
              <p>{agentPlan.reasoning}</p>
              <div className="canvas-agent-prompt-review">
                <div className="canvas-agent-prompt-review-head"><b>{zh ? 'Prompt 对比' : 'Prompt review'}</b><small>{agentPlan.prompt.trim() === prompt.trim() ? (zh ? '未改写' : 'No rewrite') : (zh ? '待你确认' : 'Awaiting confirmation')}</small></div>
                <div className="canvas-agent-prompt-review-grid">
                  <div><small>{zh ? '当前 Prompt' : 'Current prompt'}</small><p>{prompt.trim() || '—'}</p></div>
                  <div><small>{zh ? 'Agent 优化版本' : 'Agent version'}</small><p>{agentPlan.prompt.trim() || '—'}</p></div>
                </div>
                <button type="button" className="canvas-agent-prompt-apply" disabled={!agentPlan.prompt.trim() || agentPlan.prompt.trim() === prompt.trim()} onClick={applyAgentPrompt}>{zh ? '应用优化 Prompt' : 'Apply optimized Prompt'}</button>
                <small className="canvas-agent-prompt-note">{zh ? '只会替换文字，不会改变已锁定的模型；应用后仍需你确认再生成。' : 'This only replaces the text. The locked model stays unchanged; review again before generating.'}</small>
              </div>
              {agentPlan.referenceImageRoles && agentPlan.referenceImageRoles.length > 0 && <small>{zh ? `参考图角色：${agentPlan.referenceImageRoles.map(item => `${item.index + 1} · ${item.role}`).join('、')}` : `Reference roles: ${agentPlan.referenceImageRoles.map(item => `${item.index + 1} · ${item.role}`).join(', ')}`}</small>}
              {agentPlan.imageModel && <small>{zh ? `缺少 START，可先用 ${agentPlan.imageModel} 准备首帧。` : `No START frame yet. Prepare one with ${agentPlan.imageModel}.`}</small>}
              {agentPlan.warnings.length > 0 && <ul>{agentPlan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
              {agentPlan.suggestedActions && agentPlan.suggestedActions.length > 0 && <div className="canvas-agent-actions">
                <div className="canvas-agent-actions-head"><b>{zh ? '建议操作' : 'Suggested actions'}</b><small>{zh ? '仅在你确认后应用到当前画布' : 'Apply to this canvas only after your confirmation'}</small></div>
                <div className="canvas-agent-actions-list">
                  {agentPlan.suggestedActions.map(action => {
                    const applied = appliedAgentActionIds.includes(action.id);
                    return <button key={action.id} type="button" className={'canvas-agent-action-button ' + (action.type === 'shot.delete' ? 'is-destructive' : '')} disabled={applied} onClick={() => applyAgentAction(action)} title={action.reason || undefined}>
                      <span>{agentActionName(action, zh)}</span><small>{applied ? (zh ? '已应用' : 'Applied') : (action.reason || (zh ? '点击应用' : 'Click to apply'))}</small>
                    </button>;
                  })}
                </div>
              </div>}
            </div>}
            <p>{generationInFlight ? (zh ? '生成中发现需要修改？点击“停止生成”后即可调整 Prompt，再次提交。' : 'Need to change something while rendering? Stop the task, edit the Prompt, and submit again.') : referenceMode === 'text' ? (zh ? 'Veo 3.1 Lite 固定生成 8 秒纯文本视频，不会上传或使用当前参考图片。' : 'Veo 3.1 Lite creates a fixed 8-second text-only video and does not upload or use the current reference images.') : referenceMode === 'omni' ? (zh ? '全能参考支持 1–9 张图片；用 @图片编号说明人物、服装、场景或动作来源。MiniMax H3、Seedance 2.0 / 2.5 均可用。' : 'Omni reference accepts 1–9 images. Use @image labels to identify people, wardrobe, scenes, or motion. MiniMax H3 and Seedance 2.0 / 2.5 are supported.') : model === 'minimax-h3' ? (zh ? 'MiniMax H3 首尾帧模式将沿用 START 图片比例。' : 'MiniMax H3 start/end mode follows the START image ratio.') : (zh ? '任务异步运行；离开页面后仍会继续生成。失败不扣积分。' : 'Tasks continue asynchronously. Failed generations are not charged.')}</p>
          </div>
          </>}
          {composerCollapsed && <div id="canvas-composer-content" className="canvas-composer-collapsed-summary" aria-live="polite">
            <div className="canvas-composer-summary-references"><span>{zh ? '参考' : 'References'}</span><b>{referenceMode === 'text' ? (zh ? '纯文本' : 'Text') : referenceMode === 'omni' ? `${referenceFrames.length}/9` : `${startFrame ? 1 : 0}${endFrame ? ' + END' : ''}`}</b></div>
            <div className="canvas-composer-summary-prompt"><span>{zh ? 'Prompt' : 'Prompt'}</span><b>{prompt.trim() || (zh ? '尚未填写' : 'Not written yet')}</b></div>
            <div className="canvas-composer-summary-settings"><b>{modelName(model)}</b><span>{duration} · {resolution} · {aspectRatio}</span><em className={generation?.status || 'draft'}>{generation ? statusLabel(generation.status, zh, generation.errorCode) : (zh ? '草稿' : 'Draft')}</em></div>
          </div>}
        </section>
    </section>
  </main>;
}
