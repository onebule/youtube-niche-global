'use client';
/* eslint-disable @next/next/no-img-element */
import type { InfiniteCanvasNode, InfiniteCanvasProject, InfiniteGenerationInputs, InfiniteVideoSettings } from '@/src/lib/infinite-canvas-graph';

export function InfiniteScriptEditor({ node, zh, busy, preview, onChange, onImport, onUpload, onExtract }: {
  node: InfiniteCanvasNode; zh: boolean; busy: boolean; preview?: string;
  onChange: (patch: Partial<InfiniteCanvasNode>) => void;
  onImport: (file: File) => void; onUpload: (file: File) => void; onExtract: () => void;
}) {
  const copy = (cn: string, en: string) => zh ? cn : en;
  return <div className="infinite-script-editor">
    <div className="infinite-script-intro"><b>{copy('脚本素材', 'Script source')}</b><small>{copy('粘贴文字，或从脚本截图识别。', 'Paste text, or read a script screenshot.')}</small></div>
    <div className="infinite-script-imports">
      <label className="infinite-upload">{copy('导入文字', 'Import text')}<input aria-label={copy('导入脚本文字', 'Import script text')} type="file" accept=".txt,.md,text/plain,text/markdown" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} /></label>
      <label className="infinite-upload">{copy('上传脚本截图', 'Upload screenshot')}<input aria-label={copy('上传脚本截图', 'Upload script screenshot')} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} /></label>
    </div>
    {node.assetId && <div className="infinite-script-source">
      {preview ? <img src={preview} alt={node.assetName || copy('脚本截图', 'Script screenshot')} /> : <small>{copy('截图预览读取中…', 'Loading screenshot…')}</small>}
      <small>{node.assetName}</small><button type="button" disabled={busy} onClick={onExtract}>{busy ? copy('处理中…', 'Processing…') : copy('识别截图文字', 'Read screenshot text')}</button>
      <small>{copy('Team 账号可用；识别前需确认服务方费用。不会自动生成视频。', 'Team access required. Confirm possible provider charges before OCR. No video is generated.')}</small>
    </div>}
    <label>{copy('已确认脚本', 'Reviewed script')}<textarea aria-label={copy('脚本文字', 'Script text')} placeholder={copy('粘贴脚本；可保留全文，在视频节点选择引用行段。', 'Paste your script. Select the lines to use in each video node.')} value={node.text} maxLength={12000} onChange={event => onChange({ text: event.target.value })} /></label>
    <small>{node.text.length} / 12000 · {copy('文字编辑不调用模型', 'Editing text does not call a model')}</small>
    {node.textResult && <div className="infinite-text-result"><b>{copy('识别草稿 · 请先校对', 'OCR draft · Review first')}</b>
      <textarea aria-label={copy('待确认识别文字', 'OCR text for review')} maxLength={12000} value={node.textResult} onChange={event => onChange({ textResult: event.target.value })} />
      <button type="button" disabled={busy || !node.textResult.trim()} onClick={() => onChange({ text: node.textResult, textResult: '' })}>{copy('采用识别文字', 'Use reviewed text')}</button>
      <button type="button" disabled={busy} onClick={() => onChange({ textResult: '' })}>{copy('丢弃识别草稿', 'Discard OCR draft')}</button>
    </div>}
    <small>{copy('连接到视频的「脚本引用」圆点，或在视频节点选择此脚本。TXT / MD 须为 UTF-8；不支持 PDF / Word。', 'Connect to a video Script port, or choose this script in the video node. UTF-8 TXT / MD supported; PDF / Word are not supported.')}</small>
  </div>;
}

/** Visible references are backed by node IDs and edges, not by parsing literal @labels. */
export function InfiniteVideoReferences({ project, inputs, zh, previews, onFocus, onScript, onChange }: {
  project: InfiniteCanvasProject; inputs: InfiniteGenerationInputs; zh: boolean; previews: Record<string, string>;
  onFocus: (node: InfiniteCanvasNode) => void; onScript: (id: string) => void;
  onChange: (patch: Partial<InfiniteVideoSettings>) => void;
}) {
  const copy = (cn: string, en: string) => zh ? cn : en;
  const scripts = project.nodes.filter(node => node.kind === 'script');
  const script = inputs.scriptReference;
  const media = [
    ...(inputs.startFrame ? [{ node: inputs.startFrame, role: copy('首帧', 'Start') }] : []),
    ...(inputs.endFrame ? [{ node: inputs.endFrame, role: copy('尾帧', 'End') }] : []),
    ...inputs.referenceFrames.map(node => ({ node, role: copy('参考图', 'Reference image') })),
    ...inputs.referenceVideos.map(node => ({ node, role: copy('参考视频', 'Reference video') })),
    ...inputs.referenceAudios.map(node => ({ node, role: copy('参考音频', 'Reference audio') })),
  ];
  return <section className="infinite-reference-board" aria-label={copy('引用素材', 'Input references')}>
    <header><b>{copy('引用素材', 'Input references')}</b><small>{copy('点击标签定位来源', 'Click a label to locate its source')}</small></header>
    <div className="infinite-reference-strip">{media.map(({ node, role }, index) => <button type="button" key={`${role}:${node.id}`} className="infinite-reference-chip" title={node.assetName || node.title} onClick={() => onFocus(node)}>
      {node.kind === 'image' && node.assetId && previews[node.assetId] ? <img src={previews[node.assetId]} alt="" /> : <span aria-hidden="true">{node.kind === 'video-result' ? '▷' : '♫'}</span>}
      <b>@{copy('素材', 'media')}{index + 1}</b><small>{role}</small>
    </button>)}{script && <button type="button" className="infinite-reference-chip is-script" onClick={() => { const node = scripts.find(node => node.id === script.nodeId); if (node) onFocus(node); }} title={script.title}><span aria-hidden="true">¶</span><b>@{copy('脚本', 'script')}</b><small>{script.startLine}–{script.endLine} {copy('行', 'lines')}</small></button>}</div>
    <label>{copy('引用脚本', 'Script reference')}<select aria-label={copy('选择引用脚本', 'Choose script reference')} value={script?.nodeId || ''} onChange={event => onScript(event.target.value)}>
      <option value="">{copy('不引用脚本', 'No script reference')}</option>{scripts.map(node => <option key={node.id} value={node.id}>{node.title}{node.assetName ? ` · ${node.assetName}` : ''}</option>)}
    </select></label>
    {!scripts.length && <small>{copy('从左侧＋添加「引用脚本」节点。', 'Add a Script node using + on the left.')}</small>}
    {script && <>
      <div className="infinite-script-range"><label>{copy('起始行', 'From line')}<input type="number" min={1} max={script.totalLines} aria-label={copy('脚本引用起始行', 'Script start line')} value={script.startLine} onChange={event => onChange({ scriptRange: { startLine: Number(event.target.value), endLine: script.endLine } })} /></label>
        <label>{copy('结束行', 'To line')}<input type="number" min={1} max={script.totalLines} aria-label={copy('脚本引用结束行', 'Script end line')} value={script.endLine} onChange={event => onChange({ scriptRange: { startLine: script.startLine, endLine: Number(event.target.value) } })} /></label>
        <button type="button" onClick={() => onChange({ scriptRange: undefined })}>{copy('全文', 'All lines')}</button></div>
      <details className="infinite-script-excerpt" open><summary>{copy('实际引用文字', 'Actual script excerpt')} · {script.text.length} {copy('字', 'characters')}</summary><pre>{script.text || script.error}</pre></details>
      <small>{copy('上游文字修改后引用会更新。合并提示词最多 1200 字，超限请缩小引用行段；不会自动截断。标签仅标记来源。', 'References follow source edits. Combined prompt limit: 1200 characters. Select fewer lines if needed; no automatic truncation. Labels identify sources only.')}</small>
    </>}
  </section>;
}
