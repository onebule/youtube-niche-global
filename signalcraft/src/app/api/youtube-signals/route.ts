import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-h44ddja6n-pw820820-8728s-projects.vercel.app/api/youtube-signals';

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
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
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
