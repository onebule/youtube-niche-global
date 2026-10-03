import type { InfiniteCanvasNode } from './infinite-canvas-graph';

export type InfiniteScriptRange = { startLine: number; endLine: number };
export type InfiniteScriptReference = {
  nodeId: string; title: string; text: string; totalLines: number;
  startLine: number; endLine: number; error: string | null;
};

/** Script images are OCR sources, never video reference images. Only reviewed text is used. */
export function resolveInfiniteScript(node: InfiniteCanvasNode, range?: InfiniteScriptRange): InfiniteScriptReference {
  const lines = node.text.split(/\r\n|\r|\n/);
  const startLine = range?.startLine ?? 1, endLine = range?.endLine ?? lines.length;
  const valid = Number.isInteger(startLine) && Number.isInteger(endLine) && startLine >= 1 &&
    endLine >= startLine && endLine <= lines.length;
  const text = valid ? lines.slice(startLine - 1, endLine).join('\n') : '';
  return { nodeId: node.id, title: node.title, text, totalLines: lines.length, startLine, endLine,
    error: !valid ? '脚本引用行号无效，请重新选择。 / Invalid script line range.'
      : !text.trim() ? '脚本尚无已确认文字，请粘贴文字或采用识别结果。 / Paste text or accept the OCR result first.' : null };
}

export async function readInfiniteScriptFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<string> {
  if (!/\.(txt|md)$/i.test(file.name)) throw new Error('仅支持 UTF-8 TXT / MD 脚本。 / Use a UTF-8 TXT / MD file.');
  if (!file.size || file.size > 96000) throw new Error('脚本文件须为 1–96000 字节。 / Script file must be 1–96000 bytes.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('无法读取 UTF-8 文字，请转换编码后重试。 / Cannot read UTF-8 text.'); }
  if (!text.trim() || text.includes('\0')) throw new Error('脚本没有可用文字。 / No usable script text.');
  if (text.length > 12000) throw new Error('脚本超过 12000 字，请拆分文件；未截断或替换原文。 / Split scripts longer than 12000 characters.');
  return text;
}

export function scriptAssetStillCurrent(node: InfiniteCanvasNode | undefined, assetId: string): boolean {
  return node?.kind === 'script' && node.assetId === assetId;
}
