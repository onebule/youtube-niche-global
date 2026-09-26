'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import type { AccountSession } from '@/src/lib/auth';
import { getSession } from '@/src/lib/auth';
import { CANVAS_TEXT_MODEL_OPTIONS, loadCanvasTextModels, generateCanvasText, type CanvasTextModel, type CanvasTextModelId } from '@/src/lib/canvas-text-generation';
import type { UiLocale } from '@/src/lib/ui-language';
import { accountStorageKey, accountStorageScope } from '@/src/lib/account-storage';
import { CANVAS_TEMPLATES, resolveCanvasTemplateSettings, type CanvasTemplate } from '@/src/lib/canvas-templates';
import { VIDEO_MODEL_REGISTRY } from '@/src/lib/video-model-router';
import { buildGenerationSpecV2, createManualGenerationJob, estimateVideoCredits, loadVideoAsset, loadVideoAssetUrl,
  loadVideoModels, preflightVideoGeneration, refreshGenerationJob, uploadVideoInput, videoDurationOptions,
  VideoGenerationClientError, type VideoModel, type VideoModelId } from '@/src/lib/video-generation';
import { collectInfiniteGenerationInputs, connectInfiniteNodes, createInfiniteNode, createInfiniteProject,
  createInfiniteAttemptGuard, infiniteAssetKey, infiniteAssetIssue, infiniteModelSettings, normalizeInfiniteWorkspace, usableInfiniteModel,
  type InfiniteCanvasNode, type InfiniteCanvasProject, type InfiniteCanvasWorkspace,
  type InfiniteInputPort, type InfiniteNodeKind, type InfiniteRun, type InfiniteVideoSettings } from '@/src/lib/infinite-canvas-graph';

const ImageGenerationPanel = dynamic(() => import('./image-generation-panel'));
const uid = () => crypto.randomUUID();
const nodeWidth = (node: InfiniteCanvasNode) => node.kind === 'video' ? 440 : 280;
const terminal = (state: string) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'UNKNOWN'].includes(state);
const labels = { text: ['文本', 'Text'], image: ['图片', 'Image'], video: ['视频生成', 'Video'],
  audio: ['音频', 'Audio'], storyboard: ['分镜', 'Storyboard'], note: ['便签', 'Note'] };
const portLabels = { prompt: ['提示词', 'Prompt'], start: ['首帧', 'Start'], end: ['尾帧', 'End'], reference: ['参考素材', 'Reference'] };
const modeLabels = { text: ['文生视频', 'Text to video'], 'start-end': ['首尾帧', 'Start / end'], omni: ['全能参考', 'Omni reference'] };
type Props = { account: AccountSession | null; locale: UiLocale; onSignIn: () => void; notify: (text: string) => void; onLegacy: () => void };
type Drawer = 'nodes' | 'projects' | 'templates' | 'history' | 'help' | null;
type Gesture = { type: 'pan' | 'node'; id?: string; pointerId: number; startX: number; startY: number; x: number; y: number };

function message(cause: unknown) {
  return cause instanceof VideoGenerationClientError ? cause.message : '操作未完成，请重试。 / Operation failed. Please try again.';
}
async function dimensions(url: string) {
  const image = new Image(); image.src = url;
  await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight };
}
function frame(node: InfiniteCanvasNode | null) {
  return node ? { assetId: node.assetId, width: node.width || undefined, height: node.height || undefined } : null;
}

export default function InfiniteCanvasStudio({ account, locale, onSignIn, notify, onLegacy }: Props) {
  const zh = locale === 'zh';
  const copy = (cn: string, en: string) => zh ? cn : en;
  const storageKey = accountStorageKey('signalcraft-infinite-canvas-v5', account);
  const [workspace, setWorkspace] = useState<InfiniteCanvasWorkspace>(() => normalizeInfiniteWorkspace(null));
  const workspaceRef = useRef(workspace);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const attemptGuard = () => createInfiniteAttemptGuard(accountStorageScope(account), () =>
    mounted.current && getSession() ? accountStorageScope(getSession()) : null);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [textModels, setTextModels] = useState<CanvasTextModel[]>([]);
  const [textModelError, setTextModelError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [palette, setPalette] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [connection, setConnection] = useState<string | null>(null);
  const connectionRef = useRef<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [assetIssues, setAssetIssues] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const busyRef = useRef(new Set<string>());
  const [templateQuery, setTemplateQuery] = useState('');
  const [purpose, setPurpose] = useState('all');
  const [status, setStatus] = useState('');
  const [top, setTop] = useState(68);
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const project = workspace.projects.find(item => item.id === workspace.activeProjectId) || workspace.projects[0];
  const activeId = project.id;
  const persist = useCallback((next: InfiniteCanvasWorkspace) => {
    workspaceRef.current = next; setWorkspace(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
  }, [storageKey]);
  const patchProject = useCallback((id: string, update: (value: InfiniteCanvasProject) => InfiniteCanvasProject) => {
    const current = workspaceRef.current;
    persist({ ...current, projects: current.projects.map(item => item.id === id ? { ...update(item), updatedAt: new Date().toISOString() } : item) });
  }, [persist]);
  const patchNode = useCallback((projectId: string, nodeId: string, patch: Partial<InfiniteCanvasNode>) => {
    patchProject(projectId, current => ({ ...current, nodes: current.nodes.map(node => node.id === nodeId ? { ...node, ...patch } : node) }));
  }, [patchProject]);
  const patchVideo = (node: InfiniteCanvasNode, patch: Partial<InfiniteVideoSettings>) => {
    if (node.video) patchNode(activeId, node.id, { video: { ...node.video, ...patch } });
  };
  const changeBusy = (id: string, value: boolean) => {
    if (value) busyRef.current.add(id); else busyRef.current.delete(id);
    setBusy([...busyRef.current]);
  };

  useEffect(() => {
    let saved: InfiniteCanvasWorkspace;
    try { saved = normalizeInfiniteWorkspace(JSON.parse(localStorage.getItem(storageKey) || 'null')); }
    catch { saved = normalizeInfiniteWorkspace(null); }
    workspaceRef.current = saved;
    // This effect restores only the current account's independent V5 drafts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkspace(saved); setReady(true);
  }, [storageKey]);

  useEffect(() => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const observer = new ResizeObserver(() => setTop(header.getBoundingClientRect().bottom));
    observer.observe(header); return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    loadVideoModels().then(next => { if (!cancelled) { setModels(next); setAccessError(''); } })
      .catch(cause => { if (!cancelled) { setModels([]); setAccessError(message(cause)); } });
    return () => { cancelled = true; };
  }, [account, retry]);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    loadCanvasTextModels().then(next => { if (!cancelled) { setTextModels(next); setTextModelError(''); } })
      .catch(cause => { if (!cancelled) { setTextModels([]); setTextModelError(message(cause)); } });
    return () => { cancelled = true; };
  }, [account, retry]);

  // Signed URLs are deliberately held in memory, never in exported or persisted drafts.
  const assetIds = [...new Set(project.nodes.flatMap(node => [node.assetId, ...node.runs.map(run => run.videoAssetId)].filter((id): id is string => Boolean(id))))].sort().join('|');
  const assetNodes = project.nodes.filter(node => node.assetId).map(node => `${node.id}:${node.kind}:${node.assetId}`).join('|');
  useEffect(() => {
    if (!account || !assetIds) return;
    let cancelled = false;
    const ids = assetIds.split('|');
    Promise.allSettled(ids.map(async id => [id, await loadVideoAsset(id)] as const)).then(results => {
      if (cancelled) return;
      const urls: Record<string, string> = {};
      const issues: Record<string, string | null> = {};
      for (let index = 0; index < results.length; index++) {
        const result = results[index]; const id = ids[index];
        const asset = result.status === 'fulfilled' ? result.value[1] : null;
        const currentProject = workspaceRef.current.projects.find(item => item.id === activeId);
        for (const node of currentProject?.nodes.filter(item => item.assetId === id) || []) {
          const key = infiniteAssetKey(activeId, node.id);
          issues[key] = infiniteAssetIssue(node, asset);
          if (node.kind === 'image' && asset && !issues[key]) patchNode(activeId, node.id, { width: asset.width, height: asset.height });
        }
        if (asset) {
          urls[id] = asset.url;
        }
      }
      setAssetIssues(current => ({ ...current, ...issues }));
      setPreviews(current => { const next = { ...current, ...urls }; for (const id of ids) if (!urls[id]) delete next[id]; return next; });
    });
    return () => { cancelled = true; };
  }, [account, activeId, assetIds, assetNodes, retry, patchNode]);

  const refreshRun = useCallback(async (projectId: string, nodeId: string, run: InfiniteRun) => {
    const result = await refreshGenerationJob(run.jobId);
    const next: InfiniteRun = { ...run, state: result.job.state, generationId: result.generation?.id || run.generationId,
      videoAssetId: result.generation?.videoAssetId || result.output?.internalAssetId || run.videoAssetId,
      error: result.job.error?.message || result.generation?.errorMessage || null };
    patchProject(projectId, current => ({ ...current, nodes: current.nodes.map(node => node.id === nodeId
      ? { ...node, runs: node.runs.map(item => item.jobId === run.jobId ? next : item) } : node) }));
  }, [patchProject]);
  useEffect(() => {
    if (!account || !ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const pending = workspaceRef.current.projects.flatMap(item => item.nodes.flatMap(node => node.runs
        .filter(run => !terminal(run.state)).map(run => ({ projectId: item.id, nodeId: node.id, run }))));
      // Refresh existing jobs only; this loop never creates or retries a paid task.
      for (const item of pending) {
        if (cancelled) break;
        try { await refreshRun(item.projectId, item.nodeId, item.run); }
        catch { if (!cancelled) setStatus('任务状态同步失败，可在生成记录中手动刷新。 / Status sync failed. Refresh in history.'); }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 15000);
    };
    void poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, [account, ready, refreshRun]);

  const focusNode = (node: InfiniteCanvasNode) => {
    setSelected(node.id); setDrawer(null);
    const box = viewport.current?.getBoundingClientRect();
    if (box) {
      const scale = Math.min(1, (box.width - 100) / nodeWidth(node));
      patchProject(activeId, current => ({ ...current, view: { scale, x: (box.width + 60 - nodeWidth(node) * scale) / 2 - node.x * scale, y: 80 - node.y * scale } }));
    }
  };
  const addNode = (kind: InfiniteNodeKind) => {
    const box = viewport.current?.getBoundingClientRect();
    const view = workspaceRef.current.projects.find(item => item.id === activeId)!.view;
    const width = kind === 'video' ? 440 : 280;
    const scale = Math.min(view.scale, Math.max(0.2, ((box?.width || 900) - 100) / width));
    const node = createInfiniteNode(uid(), kind, ((box?.width || 900) / 2 + 30 - view.x) / scale - width / 2, (90 - view.y) / scale);
    if (!zh) node.title = labels[kind][1];
    patchProject(activeId, current => ({ ...current, view: { ...current.view, scale }, nodes: [...current.nodes, node] }));
    setSelected(node.id); setPalette(false); return node;
  };
  const generateText = async (node: InfiniteCanvasNode) => {
    if (!account || !node.text.trim() || !node.textModel || !textModels.find(item => item.id === node.textModel)?.enabled || busyRef.current.has(node.id)) return;
    if (!window.confirm(copy(`使用 ${node.textModel} 生成文本？本次可能产生服务方费用，原文会保留，结果供你确认。`, `Generate text with ${node.textModel}? Provider charges may apply. Your original text will be kept for review.`))) return;
    const projectId = activeId; const guard = attemptGuard();
    changeBusy(node.id, true);
    try {
      const result = await guard.run(() => generateCanvasText(node.textModel!, node.text.trim()));
      patchNode(projectId, node.id, { textResult: result.text });
      setStatus(copy('文本已生成，点击“采用结果”后才会用于连线。', 'Text generated. Choose Use result to apply it to connections.'));
    } catch (cause) { if (mounted.current) setStatus(message(cause)); }
    finally { if (mounted.current) changeBusy(node.id, false); }
  };

  const deleteNode = (id: string) => {
    const node = project.nodes.find(item => item.id === id);
    if (busyRef.current.has(id) || node?.runs.some(run => !terminal(run.state))) {
      notify(copy('任务运行期间请保留节点，以便查看结果。', 'Keep this node until the running task finishes.')); return;
    }
    patchProject(activeId, current => ({ ...current, nodes: current.nodes.filter(node => node.id !== id), edges: current.edges.filter(edge => edge.source !== id && edge.target !== id) }));
    if (selected === id) setSelected(null);
    if (connectionRef.current === id) { connectionRef.current = null; setConnection(null); }
  };
  const connect = (targetId: string, port: InfiniteInputPort) => {
    const sourceId = connectionRef.current;
    if (!sourceId) return;
    try {
      const current = workspaceRef.current.projects.find(item => item.id === workspaceRef.current.activeProjectId)!;
      const next = connectInfiniteNodes(current, uid(), sourceId, targetId, port);
      patchProject(current.id, () => next);
      connectionRef.current = null; setConnection(null); setStatus('');
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : '无法连接'); }
  };
  const outputPointer = (event: ReactPointerEvent, nodeId: string) => {
    event.stopPropagation(); connectionRef.current = nodeId; setConnection(nodeId);
    const x = event.clientX, y = event.clientY;
    const finish = (up: PointerEvent) => {
      if (Math.hypot(up.clientX - x, up.clientY - y) < 5) return;
      const target = document.elementFromPoint(up.clientX, up.clientY)?.closest<HTMLElement>('[data-input-port]');
      if (target?.dataset.nodeId && target.dataset.inputPort) connect(target.dataset.nodeId, target.dataset.inputPort as InfiniteInputPort);
    };
    document.addEventListener('pointerup', finish, { once: true });
  };
  const startGesture = (event: ReactPointerEvent<HTMLDivElement>, node?: InfiniteCanvasNode) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!node && (event.target as HTMLElement).closest('[data-canvas-ui]')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const view = workspaceRef.current.projects.find(item => item.id === activeId)!.view;
    gesture.current = { type: node ? 'node' : 'pan', id: node?.id, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, x: node?.x ?? view.x, y: node?.y ?? view.y };
    if (node) setSelected(node.id); else setSelected(null);
  };
  const moveGesture = (event: ReactPointerEvent) => {
    const drag = gesture.current; if (!drag || drag.pointerId !== event.pointerId) return;
    patchProject(activeId, current => {
      const factor = drag.type === 'node' ? current.view.scale : 1;
      const x = drag.x + (event.clientX - drag.startX) / factor, y = drag.y + (event.clientY - drag.startY) / factor;
      return drag.type === 'node' ? { ...current, nodes: current.nodes.map(node => node.id === drag.id ? { ...node, x, y } : node) }
        : { ...current, view: { ...current.view, x, y } };
    });
  };
  const zoom = useCallback((factor: number, x?: number, y?: number) => {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return;
    const px = x === undefined ? box.width / 2 : x - box.left, py = y === undefined ? box.height / 2 : y - box.top;
    const id = workspaceRef.current.activeProjectId;
    patchProject(id, current => {
      const scale = Math.max(0.2, Math.min(2.5, current.view.scale * factor));
      const ratio = scale / current.view.scale;
      return { ...current, view: { scale, x: px - (px - current.view.x) * ratio, y: py - (py - current.view.y) * ratio } };
    });
  }, [patchProject]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('[data-canvas-ui]')) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) zoom(Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
      else patchProject(workspaceRef.current.activeProjectId, current => ({ ...current, view: { ...current.view, x: current.view.x - event.deltaX, y: current.view.y - event.deltaY } }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [ready, zoom, patchProject]);
  const fit = () => {
    const box = viewport.current?.getBoundingClientRect(); if (!box) return;
    if (!project.nodes.length) { patchProject(activeId, current => ({ ...current, view: { x: 0, y: 0, scale: 1 } })); return; }
    const minX = Math.min(...project.nodes.map(node => node.x)), minY = Math.min(...project.nodes.map(node => node.y));
    const heights = new Map([...viewport.current!.querySelectorAll<HTMLElement>('[data-canvas-node]')].map(element => [element.dataset.canvasNode, element.getBoundingClientRect().height / project.view.scale]));
    const maxX = Math.max(...project.nodes.map(node => node.x + nodeWidth(node))), maxY = Math.max(...project.nodes.map(node => node.y + (heights.get(node.id) || 360)));
    const scale = Math.max(0.2, Math.min(1, (box.width - 150) / (maxX - minX), (box.height - 160) / (maxY - minY)));
    patchProject(activeId, current => ({ ...current, view: { scale, x: (box.width - (maxX - minX) * scale) / 2 - minX * scale, y: 70 - minY * scale } }));
  };
  const onKey = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') { setPalette(false); setDrawer(null); setImageOpen(false); setConnection(null); connectionRef.current = null; gesture.current = null; return; }
    if ((event.target as HTMLElement).closest('input,textarea,select,button,a')) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); deleteNode(selected); }
    if (selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); const step = event.shiftKey ? 30 : 10;
      patchProject(activeId, current => ({ ...current, nodes: current.nodes.map(node => node.id === selected
        ? { ...node, x: node.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: node.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) } : node) }));
    }
  };
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = drawerRef.current; element?.querySelector<HTMLElement>('button,input,select')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !element) return;
      const items = [...element.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    element?.addEventListener('keydown', trap);
    return () => { element?.removeEventListener('keydown', trap); previous?.focus(); };
  }, [drawer]);

  const upload = async (node: InfiniteCanvasNode, file: File) => {
    if (!account) { onSignIn(); return; }
    if (busyRef.current.has(node.id)) return;
    const projectId = activeId; changeBusy(node.id, true);
    const guard = attemptGuard();
    const url = URL.createObjectURL(file);
    try {
      const size = node.kind === 'image' ? await guard.run(() => dimensions(url)) : undefined;
      const assetId = await guard.run(() => uploadVideoInput(file, size, node.kind === 'audio' ? 'audio' : 'image'));
      patchNode(projectId, node.id, { assetId, assetName: file.name, width: size?.width || null, height: size?.height || null });
      const preview = await guard.run(() => loadVideoAssetUrl(assetId)); setPreviews(current => ({ ...current, [assetId]: preview }));
    } catch (cause) { setStatus(message(cause)); } finally { URL.revokeObjectURL(url); changeBusy(node.id, false); }
  };
  const generate = async (node: InfiniteCanvasNode) => {
    if (!account) { onSignIn(); return; }
    if (!node.video?.model || busyRef.current.has(node.id) || node.runs.some(run => !terminal(run.state))) return;
    const current = workspaceRef.current.projects.find(item => item.id === activeId)!;
    const input = collectInfiniteGenerationInputs(current, node.id);
    const settings = node.video, model = models.find(item => item.id === settings.model);
    const preflight = preflightVideoGeneration({ language: locale, model: settings.model!, modelReady: usableInfiniteModel(model, settings.mode),
      prompt: input.prompt, referenceMode: settings.mode, startFrame: frame(input.startFrame), endFrame: frame(input.endFrame),
      referenceFrames: input.referenceFrames.map(item => frame(item)!), referenceAudioCount: input.referenceAudios.length,
      duration: settings.duration, aspectRatio: settings.aspectRatio, resolution: settings.resolution });
    const errors = [...input.errors, ...preflight.errors.map(item => item.message)];
    if (errors.length) { setStatus(errors[0]); return; }
    changeBusy(node.id, true); const actionId = uid(), projectId = current.id;
    const guard = attemptGuard();
    try {
      const media = [input.startFrame, input.endFrame, ...input.referenceFrames, ...input.referenceAudios].filter((item): item is InfiniteCanvasNode => Boolean(item));
      const checked = await guard.run(() => Promise.all(media.map(async item => ({ node: item, asset: await loadVideoAsset(item.assetId!) }))));
      for (const { node: source, asset } of checked) {
        const issue = infiniteAssetIssue(source, asset); if (issue) throw new VideoGenerationClientError(issue, 422);
        if (source.kind === 'image') {
          const validated = preflightVideoGeneration({ language: locale, model: settings.model!, modelReady: true, prompt: input.prompt,
            referenceMode: settings.mode, startFrame: { assetId: source.assetId, width: asset.width!, height: asset.height! },
            referenceFrames: [{ assetId: source.assetId, width: asset.width!, height: asset.height! }], duration: settings.duration,
            aspectRatio: settings.aspectRatio, resolution: settings.resolution });
          if (!validated.ok) throw new VideoGenerationClientError(validated.errors[0].message, 422);
        }
      }
      const latestModel = (await guard.run(() => loadVideoModels())).find(item => item.id === settings.model);
      if (!usableInfiniteModel(latestModel, settings.mode)) throw new VideoGenerationClientError(copy('锁定模型当前不可用，请重新选择。', 'The locked model is unavailable. Choose a model again.'), 422);
      const cost = estimateVideoCredits(latestModel, settings.duration);
      if (!window.confirm(copy(`提交 ${settings.model} 视频任务？${latestModel?.ownerUnlimited ? '当前账号免积分。' : cost === null ? '费用以服务端核算为准。' : `预计消耗 ${cost} 积分。`}`, `Submit a ${settings.model} video task? ${latestModel?.ownerUnlimited ? 'No credits for this account.' : cost === null ? 'The server will calculate the cost.' : `Estimated cost: ${cost} credits.`}`))) return;
      const generationSpec = buildGenerationSpecV2({ model: settings.model!, prompt: input.prompt, referenceMode: settings.mode,
        startImageAssetId: input.startFrame?.assetId, endImageAssetId: input.endFrame?.assetId,
        referenceImageAssetIds: input.referenceFrames.map(item => item.assetId!), referenceAudioAssetIds: input.referenceAudios.map(item => item.assetId!),
        duration: settings.duration, aspectRatio: settings.aspectRatio, resolution: settings.resolution },
      { requestId: actionId, idempotencyKey: actionId, generationGroupId: projectId, shotId: node.id, userConfirmed: true });
      guard.assert();
      const result = await guard.run(() => createManualGenerationJob({ specificationId: `canvas:${projectId}:shot:${node.id}:spec-v1`,
        generationUnitId: `canvas:${projectId}:shot:${node.id}:unit:${actionId}`, routingDecisionId: `canvas:${projectId}:shot:${node.id}:model:${settings.model}`,
        selectedModelId: settings.model!, executionMode: 'MANUAL_SINGLE_JOB', clientActionId: `canvas:${projectId}:${node.id}:${actionId}`, generationSpec }));
      const run: InfiniteRun = { jobId: result.job.id, generationId: result.generation?.id || null, state: result.job.state,
        videoAssetId: result.generation?.videoAssetId || null, error: result.job.error?.message || null, submittedAt: new Date().toISOString() };
      patchProject(projectId, value => ({ ...value, nodes: value.nodes.map(item => item.id === node.id ? { ...item, runs: [...item.runs, run] } : item) }));
      notify(copy('视频任务已提交，可在节点中查看进度。', 'Video task submitted. Track it in this node.'));
    } catch (cause) { setStatus(message(cause)); } finally { changeBusy(node.id, false); }
  };
  const applyTemplate = (template: CanvasTemplate) => {
    const target = project.nodes.find(node => node.id === selected && node.video);
    const definition = VIDEO_MODEL_REGISTRY.find(item => item.id === target?.video?.model) || null;
    const resolved = target?.video?.model ? resolveCanvasTemplateSettings(template, definition,
      Boolean(models.find(item => item.id === target.video!.model)?.enabled)) : null;
    if (resolved && !resolved.ok) { setStatus(copy('模板与锁定模型不兼容，请手动选择其他模型或模板。', 'This preset is incompatible with the locked model. Choose another model or preset.')); return; }
    const node = target || addNode('video');
    patchNode(activeId, node.id, { video: { ...node.video!, mode: template.referenceMode, prompt: zh ? template.promptZh : template.promptEn,
      duration: resolved?.ok ? resolved.duration : template.duration, aspectRatio: resolved?.ok ? resolved.aspectRatio : template.aspectRatio,
      resolution: resolved?.ok ? resolved.resolution : template.resolution } });
    setDrawer(null); setSelected(node.id);
  };
  const exportProject = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, activeProjectId: activeId, projects: [project] }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `signalcraft-canvas-${activeId}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importProject = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('文件过大');
      const raw = JSON.parse(await file.text());
      if (raw.version !== 1 || !Array.isArray(raw.projects) || !raw.projects.length) throw new Error('无效格式');
      const imported = normalizeInfiniteWorkspace(raw).projects.map(item => ({ ...item, id: uid() }));
      const current = workspaceRef.current;
      if (current.projects.length + imported.length > 40) throw new Error('项目超过 40 个');
      persist({ ...current, activeProjectId: imported[0].id, projects: [...current.projects, ...imported] }); setSelected(null); setDrawer(null);
    } catch { setStatus(copy('无法导入，请选择有效的画布 JSON 文件（最多 5MB，40 个项目）。', 'Choose a valid canvas JSON file (up to 5MB and 40 projects).')); }
  };
  const templateList = CANVAS_TEMPLATES.filter(item => (purpose === 'all' || item.purpose === purpose) &&
    [item.labelZh, item.labelEn, item.descriptionZh, item.descriptionEn, ...item.tagsZh, ...item.tagsEn].join(' ').toLowerCase().includes(templateQuery.trim().toLowerCase()));

  if (!ready) return <main className="page">{copy('正在打开画布…', 'Opening canvas…')}</main>;
  return <main className="infinite-studio" style={{ top }} onKeyDown={onKey}>
    <header className="infinite-topbar" data-canvas-ui>
      <button type="button" className="infinite-project-button" onClick={() => setDrawer('projects')} title={copy('切换项目', 'Switch project')}>▧</button>
      <input aria-label={copy('项目名称', 'Project title')} value={project.title} maxLength={85} onChange={event => patchProject(activeId, current => ({ ...current, title: event.target.value }))} />
      <span className={saveError ? 'infinite-save-error' : 'infinite-save-state'}>{saveError ? copy('保存失败，请导出备份', 'Save failed. Export a backup') : copy('已保存至当前设备', 'Saved on this device')}</span>
      <button type="button" onClick={onLegacy}>{copy('镜头工作区 ↗', 'Shot workspace ↗')}</button>
    </header>
    <div ref={viewport} className="infinite-viewport" tabIndex={0} aria-label={copy('无限画布，拖动空白处平移', 'Infinite canvas. Drag the background to pan')}
      onPointerDown={event => startGesture(event)} onPointerMove={moveGesture} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}
      style={{ backgroundPosition: `${project.view.x}px ${project.view.y}px`, backgroundSize: `${24 * project.view.scale}px ${24 * project.view.scale}px` }}>
      <div className="infinite-world" style={{ transform: `translate(${project.view.x}px,${project.view.y}px) scale(${project.view.scale})` }}>
        <svg className="infinite-edges" aria-hidden="true">
          {project.edges.map(edge => {
            const source = project.nodes.find(node => node.id === edge.source), target = project.nodes.find(node => node.id === edge.target);
            if (!source || !target) return null;
            const sx = source.x + nodeWidth(source), sy = source.y + 63, tx = target.x, ty = target.y + 63 + Object.keys(portLabels).indexOf(edge.port) * 30;
            const bend = Math.max(80, Math.abs(tx - sx) / 2);
            return <path key={edge.id} d={`M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx},${ty}`} />;
          })}
        </svg>
        {project.nodes.map(node => <article key={node.id} data-canvas-ui data-canvas-node={node.id} className={`infinite-node is-${node.kind}${selected === node.id ? ' is-selected' : ''}`}
          style={{ left: node.x, top: node.y, width: nodeWidth(node) }} onPointerDown={() => setSelected(node.id)}>
          <div className="infinite-node-heading" tabIndex={0} role="button" aria-label={copy(`移动 ${node.title}，方向键调整位置`, `Move ${node.title} with arrow keys`)}
            onFocus={() => setSelected(node.id)} onPointerDown={event => { if (!(event.target as HTMLElement).closest('button')) startGesture(event, node); }}>
            <span>{labels[node.kind][zh ? 0 : 1]}</span><b>{node.title}</b>
            <button type="button" aria-label={copy(`删除 ${node.title}`, `Delete ${node.title}`)} onClick={() => deleteNode(node.id)}>×</button>
          </div>
          {node.kind !== 'video' && <button type="button" className={`infinite-output${connection === node.id ? ' is-connecting' : ''}`} aria-label={copy(`连接 ${node.title} 的输出`, `Connect output of ${node.title}`)}
            onPointerDown={event => outputPointer(event, node.id)} onClick={() => { connectionRef.current = node.id; setConnection(node.id); }}>●</button>}
          {node.kind === 'video' ? <>
            <div className="infinite-inputs">{(Object.keys(portLabels) as InfiniteInputPort[]).map(port => <button key={port} type="button" data-node-id={node.id} data-input-port={port}
              aria-label={copy(`连接到 ${node.title} 的${portLabels[port][0]}`, `Connect to ${node.title} ${portLabels[port][1]}`)} onClick={() => connect(node.id, port)}>●<span>{portLabels[port][zh ? 0 : 1]}</span></button>)}</div>
            <VideoEditor node={node} project={project} models={account ? models : []} zh={zh} busy={busy.includes(node.id)}
              onChange={patch => patchVideo(node, patch)} onGenerate={() => void generate(node)} previews={previews} assetIssues={assetIssues} onTemplates={() => { setSelected(node.id); setDrawer('templates'); }} />
            {node.runs.length > 0 && <div className="infinite-runs">{node.runs.slice().reverse().map((run, index) => <div key={run.jobId}>
              <div><b>V{node.runs.length - index}</b><span>{run.state}</span><button type="button" onClick={() => void refreshRun(activeId, node.id, run).catch(cause => setStatus(message(cause)))}>{copy('刷新', 'Refresh')}</button></div>
              {run.videoAssetId && previews[run.videoAssetId] && <video src={previews[run.videoAssetId]} controls preload="metadata" />}
              {run.error && <p role="alert">{run.error}</p>}
            </div>)}</div>}
          </> : node.kind === 'image' || node.kind === 'audio' ? <div className="infinite-media-body">
            {node.assetId && previews[node.assetId] ? node.kind === 'image' ? <img src={previews[node.assetId]} alt={node.assetName || node.title} /> : <audio controls src={previews[node.assetId]} />
              : <div className="infinite-media-empty">{node.assetId ? copy('预览尚未加载，点击刷新重新读取', 'Preview unavailable. Refresh to reload') : copy('上传素材后连接到视频节点', 'Upload media, then connect to a video node')}</div>}
            <small>{node.assetName || copy(node.kind === 'image' ? 'JPG / PNG / WEBP · 20MB 以内' : 'MP3 / WAV · 15MB 以内', node.kind === 'image' ? 'JPG / PNG / WEBP · Up to 20MB' : 'MP3 / WAV · Up to 15MB')}</small>
            <label className="infinite-upload">{busy.includes(node.id) ? copy('上传中…', 'Uploading…') : copy('选择文件', 'Choose file')}<input type="file" disabled={busy.includes(node.id)} accept={node.kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/mpeg,audio/wav,audio/x-wav'} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(node, file); event.target.value = ''; }} /></label>
            {node.assetId && <button type="button" onClick={() => setRetry(value => value + 1)}>{copy('刷新预览', 'Refresh preview')}</button>}
          </div> : <div className="infinite-text-body">
            {node.kind === 'text' && <label className="infinite-text-model">{copy('文本模型', 'Text model')}<select value={node.textModel || ''} disabled={busy.includes(node.id)} onChange={event => patchNode(activeId, node.id, { textModel: event.target.value as CanvasTextModelId || null })}><option value="">{copy('选择模型', 'Choose model')}</option>{CANVAS_TEXT_MODEL_OPTIONS.map(item => <option value={item.id} key={item.id} disabled={!textModels.find(model => model.id === item.id)?.enabled}>{item.label}{!textModels.find(model => model.id === item.id)?.enabled ? copy(' · 未就绪', ' · Unavailable') : ''}</option>)}</select></label>}
            <textarea aria-label={copy(`${node.title}内容`, `${node.title} content`)} placeholder={copy(node.kind === 'storyboard' ? '写下场景、镜头和动作…' : '写下内容，也可以描述希望模型生成什么…', 'Write text or describe what you want the model to write…')} value={node.text} maxLength={12000} onChange={event => patchNode(activeId, node.id, { text: event.target.value })} />
            {node.kind === 'text' && <>
              {textModelError && <small role="status">{textModelError}</small>}
              {node.textModel && textModels.find(item => item.id === node.textModel && !item.enabled)?.reason && <small role="status">{textModels.find(item => item.id === node.textModel)?.reason}</small>}
              <div className="infinite-text-actions"><button type="button" onClick={() => setRetry(value => value + 1)}>{copy('检查模型', 'Check models')}</button><button type="button" className="infinite-primary" disabled={!node.text.trim() || !textModels.find(item => item.id === node.textModel)?.enabled || busy.includes(node.id)} onClick={() => void generateText(node)}>{busy.includes(node.id) ? copy('生成中…', 'Generating…') : copy('生成文本', 'Generate text')}</button></div>
              {node.textResult && <div className="infinite-text-result"><small>{copy('生成结果 · 原文仍保留', 'Generated result · Original kept')}</small><textarea readOnly aria-label={copy('文本生成结果', 'Generated text result')} value={node.textResult} /><button type="button" disabled={busy.includes(node.id)} onClick={() => patchNode(activeId, node.id, { text: node.textResult, textResult: '' })}>{copy('采用结果', 'Use result')}</button></div>}
            </>}
          </div>}
          {project.edges.filter(edge => edge.target === node.id).length > 0 && <details className="infinite-connections"><summary>{copy('已连接素材', 'Connected inputs')}</summary>{project.edges.filter(edge => edge.target === node.id).map(edge => <div key={edge.id}>
            <span>{portLabels[edge.port][zh ? 0 : 1]} · {project.nodes.find(item => item.id === edge.source)?.title}</span><button type="button" onClick={() => patchProject(activeId, current => ({ ...current, edges: current.edges.filter(item => item.id !== edge.id) }))}>{copy('断开', 'Disconnect')}</button>
          </div>)}</details>}
        </article>)}
      </div>
      {!project.nodes.length && <div className="infinite-empty" data-canvas-ui><span>＋</span><h1>{copy('从一个想法开始', 'Start with an idea')}</h1><p>{copy('添加文字、素材或视频节点，自由连接你的创作。', 'Add text, media or a video node. Connect your creative ideas.')}</p><button type="button" onClick={() => setPalette(true)}>{copy('添加第一个节点', 'Add your first node')}</button></div>}
    </div>
    <nav className="infinite-toolbar" aria-label={copy('画布工具', 'Canvas tools')}>
      <button type="button" className="infinite-add" aria-label={copy('添加节点', 'Add node')} aria-expanded={palette} onClick={() => setPalette(value => !value)}>＋</button>
      <button type="button" title={copy('节点管理', 'Manage nodes')} aria-label={copy('节点管理', 'Manage nodes')} onClick={() => setDrawer('nodes')}>▤</button>
      <button type="button" title={copy('项目', 'Projects')} aria-label={copy('项目', 'Projects')} onClick={() => setDrawer('projects')}>▱</button>
      <button type="button" title={copy('商业模板', 'Commercial presets')} aria-label={copy('商业模板', 'Commercial presets')} onClick={() => setDrawer('templates')}>◇</button>
      <button type="button" title={copy('生成记录', 'Generation history')} aria-label={copy('生成记录', 'Generation history')} onClick={() => setDrawer('history')}>◷</button>
      <button type="button" title={copy('AI 生图', 'AI image generation')} aria-label={copy('AI 生图', 'AI image generation')} onClick={() => account ? setImageOpen(true) : onSignIn()}>✧</button>
    </nav>
    {palette && <section className="infinite-palette" aria-label={copy('添加节点', 'Add node')}><b>{copy('添加节点', 'Add node')}</b>{(Object.keys(labels) as InfiniteNodeKind[]).map(kind => <button key={kind} type="button" onClick={() => addNode(kind)}>{labels[kind][zh ? 0 : 1]}<span>＋</span></button>)}<small>{copy('3D、视频重绘和视频编辑暂未接入。', '3D, video repaint and video editing are not connected yet.')}</small></section>}
    <footer className="infinite-viewbar"><button type="button" onClick={fit}>{copy('适应画布', 'Fit view')}</button><button type="button" aria-label={copy('缩小', 'Zoom out')} onClick={() => zoom(1 / 1.2)}>−</button><span>{Math.round(project.view.scale * 100)}%</span><button type="button" aria-label={copy('放大', 'Zoom in')} onClick={() => zoom(1.2)}>＋</button><button type="button" onClick={() => setDrawer('help')}>?</button></footer>
    {connection && <div className="infinite-hint" role="status">{copy('点击视频节点的输入圆点完成连接 · Esc 取消', 'Click a video input port to connect · Esc to cancel')}</div>}
    {(!account || accessError || status || saveError) && <div className="infinite-status" role="status">
      {!account ? <><span>{copy('登录后可上传素材与生成；当前可编辑草稿。', 'Sign in to upload and generate. Draft editing is available.')}</span><button type="button" onClick={onSignIn}>{copy('登录', 'Sign in')}</button></> : <span>{status || accessError || copy('当前设备无法保存，请导出备份。', 'Local saving is unavailable. Export a backup.')}</span>}
      {accessError && <button type="button" onClick={() => setRetry(value => value + 1)}>{copy('重试', 'Retry')}</button>}
      {status && <button type="button" aria-label={copy('关闭提示', 'Dismiss message')} onClick={() => setStatus('')}>×</button>}
    </div>}
    {drawer && <div className="infinite-drawer-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setDrawer(null); }}>
      <aside ref={drawerRef} className="infinite-drawer" role="dialog" aria-modal="true" aria-labelledby="infinite-drawer-title">
        <header><h2 id="infinite-drawer-title">{copy({ nodes: '节点管理', projects: '我的项目', templates: '商业模板', history: '生成记录', help: '画布操作' }[drawer], { nodes: 'Manage nodes', projects: 'My projects', templates: 'Commercial presets', history: 'Generation history', help: 'Canvas controls' }[drawer])}</h2><button type="button" aria-label={copy('关闭面板', 'Close panel')} onClick={() => setDrawer(null)}>×</button></header>
        {drawer === 'nodes' && <>{!project.nodes.length && <p>{copy('还没有节点，点击＋开始。', 'No nodes yet. Click + to start.')}</p>}{project.nodes.map(node => <div className="infinite-list-row" key={node.id}><button type="button" onClick={() => focusNode(node)}>{node.title}<small>{labels[node.kind][zh ? 0 : 1]}</small></button><button type="button" onClick={() => deleteNode(node.id)}>{copy('删除', 'Delete')}</button></div>)}</>}
        {drawer === 'projects' && <><p>{copy('草稿按账号保存在当前设备。导出文件可备份或带到另一台设备。', 'Drafts are stored per account on this device. Export a file to back up or transfer.')}</p>
          <button type="button" className="infinite-primary" disabled={workspace.projects.length >= 40} onClick={() => { const next = createInfiniteProject(uid(), copy('未命名项目', 'Untitled')); persist({ ...workspace, activeProjectId: next.id, projects: [...workspace.projects, next] }); setSelected(null); setDrawer(null); }}>{copy('＋ 新建空白画布', '+ New blank canvas')}</button>
          {workspace.projects.map(item => <button className="infinite-project-row" type="button" key={item.id} aria-pressed={item.id === activeId} onClick={() => { persist({ ...workspace, activeProjectId: item.id }); setSelected(null); setDrawer(null); }}>{item.title || 'Untitled'}<small>{item.nodes.length} {copy('个节点', 'nodes')}</small></button>)}
          <button type="button" onClick={exportProject}>{copy('导出当前项目', 'Export current project')}</button><label className="infinite-upload">{copy('导入画布文件', 'Import canvas file')}<input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) void importProject(file); event.target.value = ''; }} /></label></>}
        {drawer === 'templates' && <><input aria-label={copy('搜索商业模板', 'Search presets')} placeholder={copy('搜索中文或英文关键词…', 'Search Chinese or English keywords…')} value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} /><select aria-label={copy('模板用途', 'Preset purpose')} value={purpose} onChange={event => setPurpose(event.target.value)}><option value="all">{copy('全部用途', 'All purposes')}</option><option value="commercial">{copy('商业广告', 'Commercial')}</option><option value="social">{copy('社交短视频', 'Social')}</option><option value="continuity">{copy('连续镜头', 'Continuity')}</option></select>
          {templateList.map(item => <button type="button" className="infinite-template-card" key={item.id} onClick={() => applyTemplate(item)}><b>{zh ? item.labelZh : item.labelEn}</b><p>{zh ? item.descriptionZh : item.descriptionEn}</p><small>{item.duration} · {item.aspectRatio}</small></button>)}{!templateList.length && <p role="status">{copy('没有匹配模板，请更换关键词或用途。', 'No matching presets. Change the keyword or purpose.')}</p>}</>}
        {drawer === 'history' && <>{!project.nodes.some(node => node.runs.length) && <p>{copy('还没有生成记录。任务提交后会保留在对应视频节点中。', 'No generation history. Submitted tasks stay in their video nodes.')}</p>}{project.nodes.flatMap(node => node.runs.map(run => <div className="infinite-list-row" key={run.jobId}><button type="button" onClick={() => focusNode(node)}>{node.title}<small>{run.state} · {new Date(run.submittedAt).toLocaleString()}</small></button><button type="button" onClick={() => void refreshRun(activeId, node.id, run).catch(cause => setStatus(message(cause)))}>{copy('刷新', 'Refresh')}</button></div>))}</>}
        {drawer === 'help' && <><p>{copy('拖动空白处平移；滚轮平移；Ctrl / ⌘ + 滚轮缩放。拖动节点标题移动节点。', 'Drag the background or scroll to pan. Ctrl / ⌘ + scroll zooms. Drag a node heading to move it.')}</p><p>{copy('从素材右侧圆点拖到视频输入圆点，或依次点击两个圆点连接。展开「已连接素材」可断开。', 'Drag from a media output to a video input, or click the two ports in order. Expand Connected inputs to disconnect.')}</p><p>{copy('Tab 选择控件；节点标题获得焦点后用方向键移动，Delete 删除；Esc 关闭面板或取消连线。生成需手动点击并确认费用。', 'Tab selects controls. With a heading focused, use arrows to move and Delete to remove. Esc closes panels or cancels a connection. Generation requires a click and cost confirmation.')}</p></>}
      </aside>
    </div>}
    {imageOpen && <div><ImageGenerationPanel key={accountStorageScope(account)} open zh={zh} storageScope={accountStorageScope(account)} onClose={() => setImageOpen(false)} notify={notify}
      onUseAsReference={(assetId, imageUrl) => { const projectId = activeId, node = addNode('image'); setImageOpen(false);
        void dimensions(imageUrl).then(size => { patchNode(projectId, node.id, { assetId, assetName: copy('AI 生成图片', 'AI generated image'), ...size }); setPreviews(current => ({ ...current, [assetId]: imageUrl })); })
          .catch(() => { patchNode(projectId, node.id, { assetId, assetName: 'AI image' }); setStatus(copy('图片尺寸未读取，请刷新预览后再生成视频。', 'Image dimensions unavailable. Refresh the preview before generating video.')); }); }} /></div>}
  </main>;
}

function VideoEditor({ node, project, models, zh, busy, onChange, onGenerate, previews, assetIssues, onTemplates }: {
  node: InfiniteCanvasNode; project: InfiniteCanvasProject; models: VideoModel[]; zh: boolean; busy: boolean;
  onChange: (patch: Partial<InfiniteVideoSettings>) => void; onGenerate: () => void; previews: Record<string, string>; assetIssues: Record<string, string | null>; onTemplates: () => void;
}) {
  const settings = node.video!;
  const [modelOpen, setModelOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const [task, setTask] = useState('all');
  const copy = (cn: string, en: string) => zh ? cn : en;
  const model = models.find(item => item.id === settings.model);
  const definition = VIDEO_MODEL_REGISTRY.find(item => item.id === settings.model);
  const inputs = collectInfiniteGenerationInputs(project, node.id);
  const preflight = preflightVideoGeneration({ language: zh ? 'zh' : 'en', model: settings.model || 'auto', modelReady: usableInfiniteModel(model, settings.mode),
    prompt: inputs.prompt, referenceMode: settings.mode, startFrame: frame(inputs.startFrame), endFrame: frame(inputs.endFrame),
    referenceFrames: inputs.referenceFrames.map(item => frame(item)!), referenceAudioCount: inputs.referenceAudios.length,
    duration: settings.duration, aspectRatio: settings.aspectRatio, resolution: settings.resolution });
  const issues = [...inputs.errors, ...preflight.errors.map(item => item.message)];
  const media = [inputs.startFrame, inputs.endFrame, ...inputs.referenceFrames, ...inputs.referenceAudios].filter((item): item is InfiniteCanvasNode => Boolean(item));
  for (const source of media) if (source.assetId && assetIssues[infiniteAssetKey(project.id, source.id)] !== null) issues.push(assetIssues[infiniteAssetKey(project.id, source.id)] || copy('正在核对素材可用性…', 'Checking media availability…'));
  if (definition && !definition.aspectRatios.includes(settings.aspectRatio)) issues.push(copy('当前模型不支持所选画幅。', 'This model does not support the selected aspect ratio.'));
  const credits = estimateVideoCredits(model, settings.duration);
  const filtered = VIDEO_MODEL_REGISTRY.filter(item => (provider === 'all' || item.provider === provider) &&
    (task === 'all' || (task === 'text' ? item.capabilities.textToVideo : task === 'omni' ? item.capabilities.omniReference : item.capabilities.startFrame)) &&
    [item.label, item.provider, item.id].join(' ').toLowerCase().includes(query.toLowerCase().trim()));
  const running = node.runs.some(run => !terminal(run.state));
  return <div className="infinite-video-editor">
    <div className="infinite-video-preview">{inputs.startFrame?.assetId && previews[inputs.startFrame.assetId]
      ? <img src={previews[inputs.startFrame.assetId]} alt={copy('首帧预览', 'Start frame preview')} /> : <><span>▷</span><small>{copy('连接素材，描述动作，生成视频', 'Connect media, describe motion, generate a video')}</small></>}</div>
    <div className="infinite-mode-tabs">{(Object.keys(modeLabels) as InfiniteVideoSettings['mode'][]).map(mode => <button key={mode} type="button" aria-pressed={settings.mode === mode} onClick={() => onChange({ mode })}>{modeLabels[mode][zh ? 0 : 1]}</button>)}</div>
    <button type="button" className="infinite-model-button" aria-expanded={modelOpen} onClick={() => setModelOpen(value => !value)}><span>✧ {definition?.label || copy('选择模型', 'Choose model')}</span><small>{settings.model ? copy('已锁定', 'Locked') : copy('待选择', 'Not selected')} ▾</small></button>
    {modelOpen && <div className="infinite-model-picker" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setModelOpen(false); } }}><input aria-label={copy('搜索模型', 'Search models')} placeholder={copy('搜索模型…', 'Search models…')} value={query} onChange={event => setQuery(event.target.value)} />
      <div><select aria-label={copy('服务方', 'Provider')} value={provider} onChange={event => setProvider(event.target.value)}><option value="all">{copy('全部服务方', 'All providers')}</option>{[...new Set(VIDEO_MODEL_REGISTRY.map(item => item.provider))].map(name => <option key={name}>{name}</option>)}</select>
      <select aria-label={copy('任务能力', 'Task capability')} value={task} onChange={event => setTask(event.target.value)}><option value="all">{copy('全部任务', 'All tasks')}</option>{(Object.keys(modeLabels) as InfiniteVideoSettings['mode'][]).map(mode => <option value={mode} key={mode}>{modeLabels[mode][zh ? 0 : 1]}</option>)}</select></div>
      {filtered.map(item => {
        const api = models.find(model => model.id === item.id);
        const available = item.adapterStatus !== 'planned' && usableInfiniteModel(api, settings.mode);
        return <button type="button" key={item.id} disabled={!available} title={!available ? api?.reason || copy('未就绪或不支持当前任务', 'Not ready or incompatible with this task') : item.label}
          onClick={() => { const id = item.id as Exclude<VideoModelId, 'auto'>; const defaults = infiniteModelSettings(id);
            onChange({ model: id, duration: defaults.duration, resolution: defaults.resolution,
              aspectRatio: item.aspectRatios.includes(settings.aspectRatio) ? settings.aspectRatio : '16:9' }); setModelOpen(false); }}>
          <b>{item.label}</b><small>{available ? copy('可用', 'Ready') : copy('未就绪 / 不支持', 'Unavailable / incompatible')} · {item.provider}</small></button>;
      })}{!filtered.length && <p role="status">{copy('没有匹配模型，请调整筛选。', 'No matching models. Adjust the filters.')}</p>}
    </div>}
    <div className="infinite-specs"><label>{copy('时长', 'Duration')}<select value={settings.duration} onChange={event => onChange({ duration: event.target.value })}>
      {!videoDurationOptions(settings.model || 'auto').includes(settings.duration) && <option>{settings.duration}</option>}{videoDurationOptions(settings.model || 'auto').map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{copy('分辨率', 'Resolution')}<select value={settings.resolution} onChange={event => onChange({ resolution: event.target.value })}>
        {!(definition?.resolutions || ['720p']).includes(settings.resolution) && <option>{settings.resolution}</option>}{(definition?.resolutions || ['720p']).map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{copy('画幅', 'Aspect ratio')}<select value={settings.aspectRatio} onChange={event => onChange({ aspectRatio: event.target.value as InfiniteVideoSettings['aspectRatio'] })}>
        {!(definition?.aspectRatios || ['9:16', '16:9', '1:1']).includes(settings.aspectRatio) && <option>{settings.aspectRatio}</option>}{(definition?.aspectRatios || ['9:16', '16:9', '1:1']).map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <label className="infinite-prompt-label">{copy('画面与动作', 'Scene and motion')}<textarea maxLength={1200} aria-label={copy('视频提示词', 'Video prompt')} placeholder={copy('描述你想看到的画面、动作和镜头…', 'Describe the scene, motion and camera…')} value={settings.prompt} onChange={event => onChange({ prompt: event.target.value })} /></label>
    <div className="infinite-prompt-foot"><button type="button" onClick={onTemplates}>{copy('使用模板', 'Use preset')}</button><small>{inputs.prompt.length} / 1200</small></div>
    {inputs.prompt !== settings.prompt.trim() && <details><summary>{copy('查看合并后的提示词', 'View combined prompt')}</summary><p>{inputs.prompt}</p></details>}
    {issues.length > 0 && <p className="infinite-preflight" role="status">{issues[0]}</p>}
    {preflight.warnings.map(item => <small className="infinite-warning" key={item.code}>{item.message}</small>)}
    <button type="button" className="infinite-generate" disabled={busy || running || issues.length > 0} onClick={onGenerate}>
      <b>{busy || running ? copy('任务进行中…', 'Task in progress…') : copy('生成视频 →', 'Generate video →')}</b><span>{model?.ownerUnlimited ? copy('账号免积分', 'No credits') : credits === null ? copy('费用待核算', 'Cost pending') : `${credits} ${copy('积分', 'credits')}`}</span>
    </button>
  </div>;
}
