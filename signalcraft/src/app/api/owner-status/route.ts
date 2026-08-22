import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/owner-status';

export async function GET(request: NextRequest) {
  const target = new URL(upstream);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const authorization = request.headers.get('authorization');
  try {
    const response = await fetch(target, {
      headers: {
        accept: 'application/json',
        ...(authorization ? { authorization } : {}),
      },
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
      { error: '管理服务暂时不可达，请稍后重试。' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
