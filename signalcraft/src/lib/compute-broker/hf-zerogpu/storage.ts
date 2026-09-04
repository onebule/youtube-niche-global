import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const HF_H3_OUTPUT_DIR = 'tmp/generated/hf-h3';
const maxBytes = 250 * 1024 * 1024;
const isMp4 = (value: string) => /\.mp4(?:[?#].*)?$/i.test(value);

export type HfStoredVideo = { assetId: string; path: string; sourceProvider: 'HF_ZEROGPU_H3'; spaceId: string; generationId: string | null; timestamp: string; contentType: 'video/mp4' };

function outputRoot() {
  const configured = process.env.HF_H3_OUTPUT_DIR?.trim();
  return configured ? resolve(/* turbopackIgnore: true */ configured) : resolve(process.cwd(), HF_H3_OUTPUT_DIR);
}

export async function materializeHfVideoOutput(input: { url?: string | null; path?: string | null; spaceId: string; generationId?: string | null; fetchImpl?: typeof fetch }): Promise<HfStoredVideo> {
  const source = input.path || input.url;
  if (!source) throw new Error('HF H3 output does not contain an MP4 asset.');
  const targetDir = outputRoot();
  await mkdir(targetDir, { recursive: true });
  const assetId = `hf-h3-${randomUUID()}`;
  const targetPath = resolve(targetDir, `${assetId}.mp4`);
  if (input.path && !input.path.startsWith('http')) {
    if (!isMp4(input.path)) throw new Error('HF H3 output is not an MP4 asset.');
    const sourcePath = resolve(/* turbopackIgnore: true */ input.path);
    const bytes = await (await import('node:fs/promises')).readFile(sourcePath);
    if (bytes.byteLength > maxBytes) throw new Error('HF H3 output exceeds the storage size limit.');
    await writeFile(targetPath, bytes, { flag: 'wx' });
  } else {
    if (!isMp4(source)) throw new Error('HF H3 output URL is not an MP4 asset.');
    const response = await (input.fetchImpl || fetch)(source, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`HF H3 output download failed (${response.status}).`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().includes('video') && !contentType.toLowerCase().includes('mp4')) throw new Error('HF H3 output content type is not video/mp4.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error('HF H3 output exceeds the storage size limit.');
    await writeFile(targetPath, bytes, { flag: 'wx' });
  }
  const file = await stat(targetPath);
  if (file.size === 0) throw new Error('HF H3 output is empty.');
  return { assetId, path: targetPath, sourceProvider: 'HF_ZEROGPU_H3', spaceId: input.spaceId, generationId: input.generationId || null, timestamp: new Date().toISOString(), contentType: 'video/mp4' };
}

export function isSafeHfVideoPath(value: string) { return extname(basename(value)).toLowerCase() === '.mp4'; }
