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
    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) {
      return Response.json(
        { error: response.ok ? '管理服务返回了无法识别的响应。' : '管理服务暂时无法读取，请检查后端管理接口部署状态。' },
        { status: response.ok ? 502 : response.status, headers: { 'cache-control': 'no-store' } },
      );
    }
    return new Response(body, {
      status: response.status,
      headers: { 'content-type': contentType || 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: '管理服务暂时不可达，请稍后重试。' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
