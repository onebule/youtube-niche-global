import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/youtube-signals';

function jsonObject(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = body ? JSON.parse(body) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const target = new URL(upstream);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const authorization = request.headers.get('authorization');
  const forwardedFor = request.headers.get('x-forwarded-for');

  try {
    const response = await fetch(target, {
      headers: {
        accept: 'application/json',
        ...(authorization ? { authorization } : {}),
        // The quota service keys guests by IP. Preserve Vercel's original
        // client address through this same-origin proxy so anonymous visitors
        // do not share one server-side quota bucket.
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
      cache: 'no-store',
    });
    const body = await response.text();
    // Vercel returns a 401 JSON protection envelope when the upstream API
    // project has Deployment Protection enabled. Surface the configuration
    // fix directly instead of making the browser show a generic fetch error.
    if (response.status === 401 && /Protected deployment|vercel_auth_enabled/i.test(body)) {
      return Response.json(
        {
          error: '数据服务仍被 Vercel 部署保护拦截。请在后端项目 Settings → Deployment Protection 中关闭 Vercel Authentication，然后重新加载本页。',
          code: 'BACKEND_DEPLOYMENT_PROTECTED',
        },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = jsonObject(body);
    if (!payload || !/application\/json/i.test(contentType)) {
      return Response.json(
        {
          error: response.ok
            ? '排行榜数据服务返回了无法识别的响应，请稍后重试。'
            : `排行榜数据服务暂时不可用（HTTP ${response.status}）。`,
          code: response.ok ? 'UPSTREAM_NON_JSON' : 'UPSTREAM_NON_JSON_ERROR',
          upstreamStatus: response.status,
        },
        { status: response.ok ? 502 : (response.status >= 500 ? 502 : response.status), headers: { 'cache-control': 'no-store' } },
      );
    }
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': contentType || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      { error: '数据服务暂时不可达，请稍后点击“更新排行榜”重试。' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
