import type { Video } from './types';
import { clientErrorMessage } from './client-error';
import { normalizeViralCaseAnalysis, type ViralCaseAnalysis } from './viral-case';

export type ViralCaseAnalysisResponse = {
  analysis: ViralCaseAnalysis;
  source: 'configured-provider';
};

/**
 * Calls our same-origin adapter. The browser never receives provider secrets;
 * the adapter also refuses to invent a report when no provider is configured.
 */
export async function requestViralCaseAnalysis(video: Video): Promise<ViralCaseAnalysisResponse> {
  const response = await fetch('/api/viral-case-analysis', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      videoId: video.id,
      sourceUrl: video.sourceUrl,
      title: video.title,
      durationSeconds: video.durationSeconds,
    }),
  });
  const payload = await response.json().catch(() => null) as { analysis?: unknown; source?: unknown; error?: unknown } | null;
  if (!response.ok) throw new Error(clientErrorMessage(payload?.error, '视频自动分析暂不可用。'));
  const analysis = normalizeViralCaseAnalysis(payload?.analysis);
  if (!analysis) throw new Error('分析服务返回的数据不完整，未写入拆解报告。');
  return { analysis, source: 'configured-provider' };
}
