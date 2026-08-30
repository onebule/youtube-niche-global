import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const defaultUpstream = 'https://youtube-niche-global-api.vercel.app/api/viral-case-analysis';

export async function POST(request: NextRequest) {
  const upstream = process.env.VIRAL_CASE_ANALYSIS_URL?.trim() || defaultUpstream;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: '分析请求格式无效。', code: 'INVALID_ANALYSIS_REQUEST' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || !isHttpUrl((input as { sourceUrl?: unknown }).sourceUrl)) {
    return Response.json({ error: '缺少可访问的公开视频地址。', code: 'INVALID_SOURCE_URL' }, { status: 400 });
  }

  const token = process.env.VIRAL_CASE_ANALYSIS_TOKEN?.trim();
  const incomingAuthorization = request.headers.get('authorization');
  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(incomingAuthorization ? { authorization: incomingAuthorization } : token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: '自动视频分析服务暂时不可达，请稍后重试。', code: 'ANALYSIS_PROVIDER_UNAVAILABLE' }, { status: 502 });
  }
}
