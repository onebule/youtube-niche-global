import type { Video } from './types';
import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';
import { parseYouTubeVideoId } from './youtube-video-url';
export { parseYouTubeVideoId } from './youtube-video-url';

type ApiVideo = {
  videoId: string;
  title: string;
  titleZh?: string | null;
  topic?: string;
  languageCode?: string;
  channelId: string;
  channelTitle: string;
  channelUrl?: string;
  videoUrl: string;
  thumbnail?: string;
  views: number;
  subscribers: number;
  ageDays: number;
  publishedAt: string;
  durationSeconds: number;
  likes?: number;
  comments?: number;
  isMadeForKids?: boolean;
  format: 'short' | 'long' | 'unknown';
  formatConfidence?: 'high' | 'medium' | 'low';
  formatSource?: string;
  viralLabel?: string;
};

type ApiResponse = { video?: ApiVideo; error?: unknown };

const thumbnailEndpoint = 'https://youtube-niche-global-api.vercel.app/api/thumbnail';

function displayLanguage(code?: string) {
  const normalized = String(code || '').toLowerCase();
  if (normalized.startsWith('en')) return '英语';
  if (normalized.startsWith('es')) return '西班牙语';
  if (normalized.startsWith('pt')) return '葡萄牙语';
  if (normalized.startsWith('zh')) return '中文';
  if (normalized.startsWith('ja')) return '日语';
  if (normalized.startsWith('ko')) return '韩语';
  return '未标注';
}

export async function resolveYouTubeVideo(sourceUrl: string): Promise<Video> {
  const videoId = parseYouTubeVideoId(sourceUrl.trim());
  if (!videoId) throw new Error('请输入有效的 YouTube 视频链接。');
  const response = await fetch(`/api/youtube-video?url=${encodeURIComponent(sourceUrl.trim())}`, { headers: { accept: 'application/json', ...authHeaders() }, cache: 'no-store' });
  const payload = await response.json().catch(() => null) as ApiResponse | null;
  if (!response.ok || !payload?.video) throw new Error(clientErrorMessage(payload?.error, '公开视频解析失败。'));
  const item = payload.video;
  const currentCapturedAt = new Date().toISOString();
  return {
    id: `yt-${item.videoId}`,
    channelId: item.channelId,
    title: item.title,
    titleZh: item.titleZh || null,
    topic: item.topic || '直接导入',
    language: displayLanguage(item.languageCode),
    region: '未标注',
    format: item.format,
    formatConfidence: item.formatConfidence || 'low',
    formatSource: item.formatSource || '公开视频元数据不足以确认内容形态',
    publishedAt: item.publishedAt,
    durationSeconds: item.durationSeconds,
    thumbnail: item.thumbnail ? `${thumbnailEndpoint}?url=${encodeURIComponent(item.thumbnail)}` : '',
    sourceUrl: item.videoUrl,
    risk: item.isMadeForKids ? 'high' : 'medium',
    snapshots: [{ capturedAt: currentCapturedAt, views: item.views, likes: item.likes || 0, comments: item.comments || 0, subscribers: item.subscribers }],
    tags: ['YouTube 公开数据', '直接导入', item.viralLabel || '公开样本'],
  };
}
