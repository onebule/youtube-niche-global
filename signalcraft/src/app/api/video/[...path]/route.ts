import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/video';

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

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = new URL(`${upstream}/${path.map(segment => encodeURIComponent(segment)).join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const authorization = request.headers.get('authorization');
  const idempotencyKey = request.headers.get('idempotency-key');
  const contentType = request.headers.get('content-type');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        accept: 'application/json',
        ...(authorization ? { authorization } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...(body && contentType ? { 'content-type': contentType } : {}),
      },
      body,
      cache: 'no-store',
    });
    const responseBody = await response.text();
    const upstreamContentType = response.headers.get('content-type') || '';
    const payload = jsonObject(responseBody);
    if (!payload || !/application\/json/i.test(upstreamContentType)) {
      return Response.json(
        {
          error: response.ok
            ? '视频服务返回了无法识别的响应，请稍后重试。'
            : `视频服务暂时不可用（HTTP ${response.status}）。`,
          code: response.ok ? 'UPSTREAM_NON_JSON' : 'UPSTREAM_NON_JSON_ERROR',
          upstreamStatus: response.status,
        },
        { status: response.ok ? 502 : (response.status >= 500 ? 502 : response.status), headers: { 'cache-control': 'no-store' } },
      );
    }
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'content-type': upstreamContentType || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      { error: 'AI 图生视频服务暂时不可达，请稍后重试。', code: 'VIDEO_SERVICE_UNAVAILABLE' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
