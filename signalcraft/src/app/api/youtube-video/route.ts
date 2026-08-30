import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/youtube-video';

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
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
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
    return Response.json({ error: '视频公开数据服务暂时不可达。', code: 'YOUTUBE_VIDEO_PROXY_UNAVAILABLE' }, { status: 502 });
  }
}
