'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';
import {
  createVideoGeneration,
  loadVideoAssetUrl,
  loadVideoHistory,
  loadVideoModels,
  refreshVideoGeneration,
  uploadVideoInput,
  VideoGenerationClientError,
  type VideoGeneration,
  type VideoModel,
  type VideoModelId,
} from '@/src/lib/video-generation';

type UploadedInput = { assetId: string; name: string; previewUrl: string; width: number; height: number };
type UploadSlot = 'start' | 'end' | null;

const MAX_HISTORY = 20;
const H3_MIN_IMAGE_SIDE = 256;
const H3_MAX_IMAGE_SIDE = 5760;
const H3_MIN_IMAGE_RATIO = 0.4;
const H3_MAX_IMAGE_RATIO = 2.5;

function copy(locale: UiLocale) {
  const zh = locale === 'zh';
  return {
    eyebrow: zh ? 'TEAM · AI STUDIO' : 'TEAM · AI STUDIO',
    title: zh ? '把一张画面，推进成下一段镜头。' : 'Move one frame into the next shot.',
    body: zh ? '仅限团队内部验证。上传 START 图片，写下运动意图；END 图片可选，用于控制镜头落点。' : 'Team-only validation. Start with an image, describe motion, and optionally set the final frame.',
    signInTitle: zh ? '先登录，再进入团队创作区。' : 'Sign in to enter the Team studio.',
    signInBody: zh ? '此能力不会向游客或普通登录用户开放。' : 'This capability is not open to guests or regular accounts.',
    signIn: zh ? '使用 Google 登录' : 'Sign in with Google',
    teamOnlyTitle: zh ? '这个账号还不在 AI Team 中。' : 'This account is not in the AI Team yet.',
    teamOnlyBody: zh ? '请让站点主人将你的邮箱加入团队白名单后重新登录。' : 'Ask the site owner to add your email to the Team allowlist, then sign in again.',
    setupTitle: zh ? '模型已连接，等待内部成本规则。' : 'Models are connected and waiting for internal cost rules.',
    setupBody: zh ? '管理员需要先配置每个模型的内部积分成本，才能创建任务。此阶段不会产生视频生成费用。' : 'An administrator must set internal credit costs before tasks can start. No generation charges occur in this state.',
    start: zh ? 'START 图片' : 'START frame',
    startHint: zh ? '必填 · JPG、PNG 或 WEBP · 小于 20 MB' : 'Required · JPG, PNG, or WEBP · under 20 MB',
    end: zh ? 'END 图片' : 'END frame',
    endHint: zh ? '选填 · 用于指定镜头落点' : 'Optional · defines where the shot lands',
    choose: zh ? '选择图片' : 'Choose image',
    replace: zh ? '更换图片' : 'Replace image',
    remove: zh ? '移除' : 'Remove',
    uploading: zh ? '上传中…' : 'Uploading…',
    motion: zh ? 'Motion Prompt' : 'Motion Prompt',
    motionHint: zh ? '描述主体、镜头运动、节奏与光线变化。' : 'Describe the subject, camera movement, pacing, and light.',
    motionPlaceholder: zh ? '例如：镜头缓慢推近人物，微风吹动衣角，午后自然光，稳定电影感。' : 'Example: Slow push toward the subject, a light breeze in the fabric, warm afternoon light, steady cinematic motion.',
    model: zh ? '模型' : 'Model',
    duration: zh ? '时长' : 'Duration',
    ratio: zh ? '画幅' : 'Aspect ratio',
    resolution: zh ? '分辨率' : 'Resolution',
    h3FrameRule: zh ? 'MiniMax H3 以 START 图片决定画幅；图片须为 256–5760 px，长宽比 0.4–2.5。' : 'MiniMax H3 follows the START frame. Images must be 256–5760 px with a 0.4–2.5 aspect ratio.',
    estimate: zh ? '预计冻结积分' : 'Credits held on submit',
    ownerCredits: zh ? '主人权限' : 'Owner access',
    ownerUnlimited: zh ? '主人账号 · 不限积分' : 'Owner account · Unlimited credits',
    generate: zh ? '生成视频' : 'Generate video',
    generating: zh ? '正在创建任务…' : 'Creating task…',
    current: zh ? '当前任务' : 'Current task',
    noTask: zh ? '还没有任务' : 'No task yet',
    noTaskBody: zh ? '上传 START 图片并填写 Motion Prompt 后，就可以创建第一条内部测试任务。' : 'Upload a START frame and write a Motion Prompt to create your first internal test.',
    loadPreview: zh ? '加载视频预览' : 'Load video preview',
    download: zh ? '下载视频' : 'Download video',
    again: zh ? '再次生成' : 'Generate again',
    syncOutput: zh ? '重新同步成片' : 'Sync generated video',
    syncingOutput: zh ? '正在同步成片…' : 'Syncing generated video…',
    syncOutputHint: zh ? '中转站已生成同一个任务；这只会同步现有结果，不会再次调用模型或产生新的 API 消耗。' : 'The same provider task is complete. This syncs the existing result without calling the model or creating new API usage.',
    syncOutputPending: zh ? '正在读取中转站的已有结果，请稍后再次打开此任务。' : 'The existing provider result is still being read. Please reopen this task shortly.',
    nextStart: zh ? '用作下一镜 START' : 'Use as next START',
    nextStartHint: zh ? '等待模型返回可保存的尾帧后开放。' : 'Available when the model returns a storable final frame.',
    history: zh ? 'Generation History' : 'Generation History',
    historyBody: zh ? '只显示当前团队账号创建的任务。' : 'Only tasks created by this Team account appear here.',
    emptyHistory: zh ? '尚无生成记录。' : 'No generation history yet.',
    more: zh ? '加载更多' : 'Load more',
    retry: zh ? '重试读取' : 'Retry',
    team: zh ? 'Team 内测' : 'Team preview',
    status: {
      queued: zh ? '排队中' : 'Queued',
      processing: zh ? '生成中' : 'Generating',
      completed: zh ? '已完成' : 'Completed',
      failed: zh ? '未完成' : 'Failed',
    },
  };
}

function modelName(model: VideoModelId) {
  if (model === 'seedance-2') return 'Seedance 2.0';
  if (model === 'minimax-h3') return 'MiniMax H3';
  return 'Auto';
}

function formatTime(value: string, locale: UiLocale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function asClientMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && (error as VideoGenerationClientError).code === 'APIMART_INVALID_REQUEST') {
    return '所选模型没有接受这组输入。请先只保留 START 图片后重试；若使用 MiniMax H3，图片需为 256–5760 px、长宽比 0.4–2.5。END 图片只在必须锁定结尾画面时添加。';
  }
  if (error && typeof error === 'object' && 'message' in error) return String((error as VideoGenerationClientError).message);
  return '操作暂时无法完成，请稍后重试。';
}

async function imageDimensions(file: File) {
  if (typeof createImageBitmap !== 'function') {
    throw new VideoGenerationClientError('当前浏览器无法读取图片尺寸，请更换为 JPG、PNG 或 WEBP 图片后重试。', 422, 'VIDEO_INPUT_DIMENSIONS_UNAVAILABLE');
  }
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function assertH3ImageDimensions(frame: UploadedInput, label: 'START' | 'END') {
  const ratio = frame.width / frame.height;
  if (
    frame.width < H3_MIN_IMAGE_SIDE || frame.height < H3_MIN_IMAGE_SIDE ||
    frame.width > H3_MAX_IMAGE_SIDE || frame.height > H3_MAX_IMAGE_SIDE ||
    ratio < H3_MIN_IMAGE_RATIO || ratio > H3_MAX_IMAGE_RATIO
  ) {
    throw new VideoGenerationClientError(
      `${label} 图片为 ${frame.width}×${frame.height}px，不符合 MiniMax H3 要求：单边 256–5760px，长宽比 0.4–2.5。`,
      422,
      'MINIMAX_IMAGE_DIMENSIONS_UNSUPPORTED',
    );
  }
}

function StatusBadge({ status, locale }: { status: VideoGeneration['status']; locale: UiLocale }) {
  return <span className={`video-status ${status}`}>{copy(locale).status[status]}</span>;
}

function FrameUploader({
  title,
  hint,
  value,
  busy,
  onSelect,
  onRemove,
  locale,
}: {
  title: string;
  hint: string;
  value: UploadedInput | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  locale: UiLocale;
}) {
  const text = copy(locale);
  return <section className={`studio-frame ${value ? 'has-file' : ''}`}>
    <div className="studio-frame-heading"><div><b>{title}</b><small>{hint}</small></div>{value && <button type="button" className="frame-remove" onClick={onRemove}>{text.remove}</button>}</div>
    {value ? <div className="frame-preview">{/* Local browser preview; Next Image cannot optimize a blob URL. */}<img src={value.previewUrl} alt={`${title}: ${value.name}`} width={320} height={180} /><span>{value.name}</span><label className="frame-replace"><input type="file" name={`${title}-replace`} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) onSelect(file); event.currentTarget.value = ''; }} />{busy ? text.uploading : text.replace}</label></div>
      : <label className="frame-empty"><input type="file" name={title} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) onSelect(file); event.currentTarget.value = ''; }} /><span aria-hidden="true">＋</span><b>{busy ? text.uploading : text.choose}</b><small>{hint}</small></label>}
  </section>;
}

export default function ImageToVideoStudio({ account, locale, onSignIn, notify }: { account: AccountSession | null; locale: UiLocale; onSignIn: () => void; notify: (message: string) => void }) {
  const text = copy(locale);
  const accountEmail = account?.email || '';
  const accountToken = account?.accessToken || '';
  const [models, setModels] = useState<VideoModel[]>([]);
  const [history, setHistory] = useState<VideoGeneration[]>([]);
  const [access, setAccess] = useState<'loading' | 'ready' | 'signed-out' | 'team-only' | 'error'>(account ? 'loading' : 'signed-out');
  const [error, setError] = useState('');
  const [startFrame, setStartFrame] = useState<UploadedInput | null>(null);
  const [endFrame, setEndFrame] = useState<UploadedInput | null>(null);
  const [uploading, setUploading] = useState<UploadSlot>(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VideoModelId>('seedance-2');
  const [duration, setDuration] = useState('5s');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [resolution, setResolution] = useState('720p');
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ generationId: string; url: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncingOutput, setSyncingOutput] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  const selectedModel = useMemo(() => models.find(item => item.id === model) || null, [models, model]);
  const current = useMemo(() => history.find(item => item.id === selectedId) || history[0] || null, [history, selectedId]);
  const currentId = current?.id || null;
  const currentStatus = current?.status || null;
  const previewUrl = preview?.generationId === currentId ? preview.url : '';
  const canSyncExistingOutput = current?.status === 'failed' && current.errorCode === 'VIDEO_OUTPUT_SOURCE_REJECTED';
  const canCreate = Boolean(startFrame && prompt.trim() && selectedModel?.enabled && !submitting && !uploading);

  const upsertGeneration = useCallback((next: VideoGeneration) => {
    setHistory(previous => {
      const found = previous.some(item => item.id === next.id);
      const merged = found ? previous.map(item => item.id === next.id ? next : item) : [next, ...previous];
      return merged.toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    });
  }, []);

  const loadStudio = useCallback(async (showLoading = false) => {
    if (!account) {
      setAccess('signed-out');
      setModels([]);
      setHistory([]);
      return;
    }
    if (showLoading) setAccess('loading');
    setError('');
    try {
      const [nextModels, nextHistory] = await Promise.all([loadVideoModels(), loadVideoHistory(MAX_HISTORY)]);
      setModels(nextModels);
      setHistory(nextHistory);
      setHasMoreHistory(nextHistory.length === MAX_HISTORY);
      setSelectedId(current => current || nextHistory[0]?.id || null);
      setAccess('ready');
    } catch (cause) {
      const typed = cause as VideoGenerationClientError;
      setAccess(typed?.code === 'TEAM_ONLY' ? 'team-only' : 'error');
      setError(asClientMessage(cause));
    }
  }, [account]);

  useEffect(() => {
    if (!accountEmail || !accountToken) return;
    let cancelled = false;
    const loadForAccount = async () => {
      try {
        const [nextModels, nextHistory] = await Promise.all([loadVideoModels(), loadVideoHistory(MAX_HISTORY)]);
        if (cancelled) return;
        setModels(nextModels);
        setHistory(nextHistory);
        setHasMoreHistory(nextHistory.length === MAX_HISTORY);
        setSelectedId(current => current || nextHistory[0]?.id || null);
        setAccess('ready');
      } catch (cause) {
        if (cancelled) return;
        const typed = cause as VideoGenerationClientError;
        setAccess(typed?.code === 'TEAM_ONLY' ? 'team-only' : 'error');
        setError(asClientMessage(cause));
      }
    };
    void loadForAccount();
    return () => { cancelled = true; };
  }, [accountEmail, accountToken]);

  useEffect(() => () => { if (startFrame?.previewUrl) URL.revokeObjectURL(startFrame.previewUrl); }, [startFrame?.previewUrl]);
  useEffect(() => () => { if (endFrame?.previewUrl) URL.revokeObjectURL(endFrame.previewUrl); }, [endFrame?.previewUrl]);
  useEffect(() => {
    if (!currentId || !currentStatus || !['queued', 'processing'].includes(currentStatus) || access !== 'ready') return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const next = await refreshVideoGeneration(currentId);
        if (cancelled) return;
        upsertGeneration(next);
        if (next.status === 'queued' || next.status === 'processing') timer = window.setTimeout(() => { void refresh(); }, 4500);
      } catch (cause) {
        if (!cancelled) setError(asClientMessage(cause));
      }
    };
    timer = window.setTimeout(() => { void refresh(); }, 2500);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [access, currentId, currentStatus, upsertGeneration]);

  const selectFile = async (slot: Exclude<UploadSlot, null>, file: File) => {
    setUploading(slot);
    setError('');
    try {
      // Verify the browser can decode the chosen file before creating a
      // private storage asset. That avoids leaving an unusable upload behind.
      const dimensions = await imageDimensions(file);
      const assetId = await uploadVideoInput(file);
      const next = { assetId, name: file.name, previewUrl: URL.createObjectURL(file), ...dimensions };
      if (slot === 'start') setStartFrame(next); else setEndFrame(next);
      notify(locale === 'zh' ? '图片已上传到私有工作区。' : 'Image uploaded to the private workspace.');
    } catch (cause) {
      setError(asClientMessage(cause));
    } finally {
      setUploading(null);
    }
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || !startFrame) return;
    setSubmitting(true);
    setError('');
    try {
      if (model === 'minimax-h3') {
        assertH3ImageDimensions(startFrame, 'START');
        if (endFrame) assertH3ImageDimensions(endFrame, 'END');
      }
      const generation = await createVideoGeneration({
        model,
        prompt: prompt.trim(),
        startImageAssetId: startFrame.assetId,
        endImageAssetId: endFrame?.assetId || null,
        duration,
        aspectRatio,
        resolution,
      });
      upsertGeneration(generation);
      setSelectedId(generation.id);
      notify(locale === 'zh' ? '任务已创建，正在等待模型处理。' : 'Task created and waiting for the model.');
    } catch (cause) {
      setError(asClientMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const loadPreview = async () => {
    if (!current?.videoAssetId) return;
    setLoadingPreview(true);
    setError('');
    try { setPreview({ generationId: current.id, url: await loadVideoAssetUrl(current.videoAssetId) }); }
    catch (cause) { setError(asClientMessage(cause)); }
    finally { setLoadingPreview(false); }
  };

  const download = async () => {
    if (!current?.videoAssetId) return;
    try { window.location.assign(await loadVideoAssetUrl(current.videoAssetId, true)); }
    catch (cause) { setError(asClientMessage(cause)); }
  };

  const syncExistingOutput = async () => {
    if (!current || !canSyncExistingOutput) return;
    setSyncingOutput(true);
    setError('');
    try {
      const next = await refreshVideoGeneration(current.id);
      upsertGeneration(next);
      if (next.status === 'completed') {
        notify(locale === 'zh' ? '已同步中转站完成的视频，可以预览或下载。' : 'The completed provider video is now synced and ready to preview or download.');
      } else {
        setError(text.syncOutputPending);
      }
    } catch (cause) {
      setError(asClientMessage(cause));
    } finally {
      setSyncingOutput(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const more = await loadVideoHistory(MAX_HISTORY, history.length);
      setHistory(previous => [...previous, ...more.filter(item => !previous.some(existing => existing.id === item.id))]);
      setHasMoreHistory(more.length === MAX_HISTORY);
    } catch (cause) { setError(asClientMessage(cause)); }
    finally { setLoadingMore(false); }
  };

  if (access === 'signed-out') return <main className="app-page video-studio"><section className="studio-access"><span className="eyebrow">{text.eyebrow}</span><h1>{text.signInTitle}</h1><p>{text.signInBody}</p><button type="button" className="primary" onClick={onSignIn}>{text.signIn}</button></section></main>;
  if (access === 'team-only') return <main className="app-page video-studio"><section className="studio-access denied"><span className="eyebrow">TEAM ACCESS</span><h1>{text.teamOnlyTitle}</h1><p>{text.teamOnlyBody}</p></section></main>;

  return <main className="app-page video-studio">
    <header className="studio-intro"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.body}</p></div><div className="studio-intro-note"><b>{text.team}</b><span>{locale === 'zh' ? '模型调用、媒体转存与积分结算均由服务端处理。' : 'Model calls, media storage, and credit settlement are all server-side.'}</span></div></header>

    {error && <div className="studio-message error" role="alert">{error}<button type="button" onClick={() => { setError(''); void loadStudio(true); }}>{text.retry}</button></div>}

    {access === 'loading' ? <section className="studio-loading" aria-live="polite">{locale === 'zh' ? '正在读取团队工作台…' : 'Loading Team studio…'}</section> : <>
      {!models.some(item => item.enabled) && <section className="studio-message setup"><b>{text.setupTitle}</b><span>{text.setupBody}</span></section>}
      <div className="studio-layout">
        <form className="studio-form" onSubmit={create}>
          <div className="studio-form-head"><span>01</span><div><h2>{locale === 'zh' ? '设定镜头边界' : 'Set the shot boundary'}</h2><p>{locale === 'zh' ? 'START 决定素材起点；END 只在需要锁定结尾时使用。' : 'START defines the source. Use END only when the final composition matters.'}</p></div></div>
          <div className="studio-frames"><FrameUploader title={text.start} hint={text.startHint} value={startFrame} busy={uploading === 'start'} onSelect={file => { void selectFile('start', file); }} onRemove={() => setStartFrame(null)} locale={locale}/><FrameUploader title={text.end} hint={text.endHint} value={endFrame} busy={uploading === 'end'} onSelect={file => { void selectFile('end', file); }} onRemove={() => setEndFrame(null)} locale={locale}/></div>
          <label className="motion-field">{text.motion}<textarea name="motionPrompt" autoComplete="off" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={text.motionPlaceholder} rows={4} maxLength={1200} required /><small>{text.motionHint} {prompt.length}/1200</small></label>
          <div className="studio-controls">
            <label>{text.model}<select name="model" value={model} onChange={event => { const next = event.target.value as VideoModelId; setModel(next); if (next === 'minimax-h3' && !['768P', '2K'].includes(resolution)) setResolution('768P'); if (next === 'seedance-2' && !['480p', '720p', '1080p'].includes(resolution)) setResolution('720p'); }}><option value="auto" disabled>Auto · {locale === 'zh' ? '即将开放' : 'Coming soon'}</option>{models.filter(item => item.id !== 'auto').map(item => <option key={item.id} value={item.id}>{modelName(item.id)}{item.enabled ? '' : ` · ${locale === 'zh' ? '未就绪' : 'Not ready'}`}</option>)}</select></label>
            <label>{text.duration}<select name="duration" value={duration} onChange={event => setDuration(event.target.value)}>{['5s', '8s', '10s'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>{text.ratio}<select name="aspectRatio" value={aspectRatio} disabled={model === 'minimax-h3'} aria-describedby={model === 'minimax-h3' ? 'minimax-h3-frame-rule' : undefined} onChange={event => setAspectRatio(event.target.value as '9:16' | '16:9' | '1:1')}><option value="9:16">9:16</option><option value="16:9">16:9</option><option value="1:1">1:1</option></select></label>
            <label>{text.resolution}<select name="resolution" value={resolution} onChange={event => setResolution(event.target.value)}>{(model === 'minimax-h3' ? ['768P', '2K'] : ['480p', '720p', '1080p']).map(value => <option key={value}>{value}</option>)}</select></label>
          </div>
          {model === 'minimax-h3' && <p id="minimax-h3-frame-rule" className="studio-model-note">{text.h3FrameRule}</p>}
          <div className="studio-submit"><div><span>{selectedModel?.ownerUnlimited ? text.ownerCredits : text.estimate}</span><b>{selectedModel?.ownerUnlimited ? (locale === 'zh' ? '不限' : 'Unlimited') : selectedModel?.creditsCost ? `${selectedModel.creditsCost} credits` : '—'}</b><small>{selectedModel?.ownerUnlimited ? text.ownerUnlimited : selectedModel?.reason || (locale === 'zh' ? '成功后扣除；模型失败将自动退回。' : 'Charged on success; released if the model fails.')}</small></div><button type="submit" className="primary" disabled={!canCreate}>{submitting ? text.generating : text.generate}</button></div>
        </form>

        <aside className="studio-current" aria-label={text.current} aria-live="polite">
          <div className="studio-current-head"><div><span>02</span><h2>{text.current}</h2></div>{current && <StatusBadge status={current.status} locale={locale}/>}</div>
          {!current ? <div className="current-empty"><i aria-hidden="true">✦</i><b>{text.noTask}</b><p>{text.noTaskBody}</p></div> : <div className="current-body"><div className="current-meta"><span>{modelName(current.model)}</span><span>{current.duration} · {current.aspectRatio} · {current.resolution}</span></div><p id={`video-prompt-${current.id}`} className="current-prompt">{current.prompt}</p>{current.status === 'processing' || current.status === 'queued' ? <div className="progress-line" aria-label={`${current.progress}%`}><i style={{ width: `${Math.max(4, current.progress)}%` }} /><span>{current.progress}%</span></div> : null}{current.status === 'failed' && <><p className="current-failure">{current.errorMessage || (locale === 'zh' ? '生成未完成，已自动退回冻结积分。' : 'Generation did not complete. Held credits were released.')}</p>{canSyncExistingOutput && <div className="current-actions sync-output-actions"><button type="button" onClick={() => { void syncExistingOutput(); }} disabled={syncingOutput}>{syncingOutput ? text.syncingOutput : text.syncOutput}</button><span className="sync-output-note">{text.syncOutputHint}</span></div>}</>}{current.status === 'completed' && <>{previewUrl ? <video className="video-preview" controls playsInline preload="metadata" aria-label={locale === 'zh' ? '生成视频预览' : 'Generated video preview'} aria-describedby={`video-prompt-${current.id}`} src={previewUrl}><span>{locale === 'zh' ? '当前浏览器无法播放该视频。' : 'This browser cannot play this video.'}</span></video> : <button type="button" className="preview-empty" onClick={() => { void loadPreview(); }} disabled={loadingPreview}>{loadingPreview ? (locale === 'zh' ? '正在加载预览…' : 'Loading preview…') : text.loadPreview}</button>}<div className="current-actions"><button type="button" onClick={download}>{text.download}</button><button type="button" onClick={() => { setPrompt(current.prompt); setModel(current.model); }}>{text.again}</button><button type="button" disabled title={text.nextStartHint}>{text.nextStart}</button></div></>}</div>}
        </aside>
      </div>

      <section className="generation-history"><div className="generation-history-head"><div><span className="eyebrow">03 · HISTORY</span><h2>{text.history}</h2><p>{text.historyBody}</p></div><span>{history.length}</span></div>{history.length ? <div className="generation-list">{history.map(item => <button type="button" key={item.id} className={`generation-row ${current?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><span className="generation-status-dot" data-status={item.status} aria-hidden="true"/><span className="generation-row-main"><b>{item.prompt}</b><small>{modelName(item.model)} · {item.duration} · {formatTime(item.createdAt, locale)}</small></span><StatusBadge status={item.status} locale={locale}/><span className="generation-row-cost">{item.creditsCost || '—'} cr</span></button>)}</div> : <p className="history-empty">{text.emptyHistory}</p>}{hasMoreHistory && <button type="button" className="history-more" onClick={() => { void loadMore(); }} disabled={loadingMore}>{loadingMore ? (locale === 'zh' ? '正在加载…' : 'Loading…') : text.more}</button>}</section>
    </>}
  </main>;
}
