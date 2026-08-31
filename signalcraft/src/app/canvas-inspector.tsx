'use client';
/* eslint-disable @next/next/no-img-element */

import type { CanvasCustomNode } from '@/src/lib/canvas-shot-workspace';
import type { CanvasGenerationStatus } from '@/src/lib/canvas-generation';

type InspectorSelection =
  | { kind: 'image'; node: CanvasCustomNode; previewUrl: string }
  | { kind: 'fixed'; id: string; label: string };

export type CanvasInspectorProps = {
  zh: boolean;
  selection: InspectorSelection | null;
  shotNumber: number;
  shotDuration: string;
  aspectRatio: string;
  resolution: string;
  modelLabel: string;
  generationStatus?: CanvasGenerationStatus | null;
  generationError?: string | null;
  versionLabel?: string;
  canGenerate: boolean;
  generationBlockedReason?: string;
  onClose: () => void;
  onFocus: () => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  onUseAsReference?: () => void;
  onSetStart?: () => void;
  onSetEnd?: () => void;
  onPreview?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  onSelectBest?: () => void;
};

function statusCopy(status: CanvasGenerationStatus | null | undefined, zh: boolean) {
  if (!status) return zh ? '尚未提交' : 'Not submitted';
  const labels: Record<CanvasGenerationStatus, string> = zh
    ? { QUEUED: '排队中', SUBMITTING: '提交中', GENERATING: '生成中', PROCESSING: '处理中', SUCCESS: '已完成', FAILED: '失败', CANCELLED: '已取消' }
    : { QUEUED: 'Queued', SUBMITTING: 'Submitting', GENERATING: 'Generating', PROCESSING: 'Processing', SUCCESS: 'Success', FAILED: 'Failed', CANCELLED: 'Cancelled' };
  return labels[status];
}

export default function CanvasInspector({
  zh,
  selection,
  shotNumber,
  shotDuration,
  aspectRatio,
  resolution,
  modelLabel,
  generationStatus,
  generationError,
  versionLabel,
  canGenerate,
  generationBlockedReason,
  onClose,
  onFocus,
  onGenerateImage,
  onGenerateVideo,
  onUseAsReference,
  onSetStart,
  onSetEnd,
  onPreview,
  onDelete,
  onRetry,
  onSelectBest,
}: CanvasInspectorProps) {
  if (!selection) return null;
  const isImage = selection.kind === 'image';
  const isResult = selection.kind === 'fixed' && selection.id === 'result';
  const title = isImage
    ? (zh ? '图片检查器' : 'Image inspector')
    : (zh ? `${selection.label}检查器` : `${selection.label} inspector`);

  return <aside className="canvas-inspector" aria-labelledby="canvas-inspector-title" onPointerDown={event => event.stopPropagation()}>
    <header className="canvas-inspector-head">
      <div><span>{zh ? `镜头 ${String(shotNumber).padStart(2, '0')} · INSPECTOR` : `SHOT ${String(shotNumber).padStart(2, '0')} · INSPECTOR`}</span><b id="canvas-inspector-title">{title}</b></div>
      <button type="button" className="canvas-inspector-close" onClick={onClose} aria-label={zh ? '关闭检查器' : 'Close inspector'}>×</button>
    </header>

    <div className="canvas-inspector-body">
      {isImage && <>
        <div className="canvas-inspector-preview">{selection.previewUrl ? <img src={selection.previewUrl} alt={selection.node.body || (zh ? '当前图片' : 'Current image')} /> : <span>{zh ? '正在读取图片…' : 'Loading image…'}</span>}</div>
        <div className="canvas-inspector-title-row"><b>{selection.node.body || (zh ? '未命名图片' : 'Untitled image')}</b><small>{selection.node.assetId ? (zh ? '已绑定私有素材' : 'Private asset bound') : (zh ? '等待素材' : 'Asset pending')}</small></div>
        <div className="canvas-inspector-actions">
          <button type="button" className="is-primary" onClick={onGenerateVideo} disabled={!selection.node.assetId} title={!selection.node.assetId ? (zh ? '先绑定图片素材' : 'Bind an image asset first') : undefined}>{zh ? '带入视频生成' : 'Use for video'}</button>
          {onUseAsReference && <button type="button" onClick={onUseAsReference} disabled={!selection.node.assetId}>{zh ? '加入参考' : 'Add reference'}</button>}
          {onSetStart && <button type="button" onClick={onSetStart} disabled={!selection.node.assetId}>{zh ? '设为 START' : 'Set START'}</button>}
          {onSetEnd && <button type="button" onClick={onSetEnd} disabled={!selection.node.assetId}>{zh ? '设为 END' : 'Set END'}</button>}
          {onPreview && <button type="button" onClick={onPreview} disabled={!selection.previewUrl}>{zh ? '高清查看' : 'View HD'}</button>}
          {onDelete && <button type="button" className="is-danger" onClick={onDelete}>{zh ? '删除图片节点' : 'Delete image node'}</button>}
        </div>
      </>}

      {!isImage && <>
        <div className="canvas-inspector-shot-summary"><div><span>{zh ? '当前镜头' : 'CURRENT SHOT'}</span><b>{String(shotNumber).padStart(2, '0')}</b></div><div><span>{zh ? '状态' : 'STATUS'}</span><strong data-status={generationStatus || 'draft'}>{statusCopy(generationStatus, zh)}</strong></div></div>
        <dl className="canvas-inspector-specs"><div><dt>{zh ? '模型' : 'Model'}</dt><dd>{modelLabel}</dd></div><div><dt>{zh ? '规格' : 'Format'}</dt><dd>{shotDuration} · {aspectRatio} · {resolution}</dd></div>{versionLabel && <div><dt>{zh ? '版本' : 'Version'}</dt><dd>{versionLabel}</dd></div>}</dl>
        {generationError && <p className="canvas-inspector-error">{generationError}</p>}
        <div className="canvas-inspector-actions">
          <button type="button" onClick={onFocus}>{zh ? '定位节点' : 'Focus node'}</button>
          <button type="button" className="is-primary" onClick={onGenerateVideo}>{isResult && generationStatus === 'SUCCESS' ? (zh ? '再次生成' : 'Generate another') : (zh ? '打开视频生成' : 'Open video generator')}</button>
          {onRetry && generationStatus === 'FAILED' && <button type="button" onClick={onRetry} disabled={!canGenerate} title={!canGenerate ? generationBlockedReason : undefined}>{zh ? '重试此任务' : 'Retry this task'}</button>}
          {onSelectBest && isResult && generationStatus === 'SUCCESS' && <button type="button" onClick={onSelectBest}>{zh ? '设为最佳镜头' : 'Set as Best Take'}</button>}
        </div>
      </>}

      <div className="canvas-inspector-footer"><button type="button" onClick={onGenerateImage}><span aria-hidden="true">✦</span>{zh ? '生成一张新图片' : 'Generate a new image'}</button><small>{zh ? '所有动作只更新当前镜头草稿；提交生成仍由底部生成台确认。' : 'Actions update this shot draft; the composer still confirms paid generation.'}</small></div>
    </div>
  </aside>;
}
