import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/video';

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
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
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
