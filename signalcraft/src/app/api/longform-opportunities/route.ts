import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/longform-opportunities';

export async function GET(request: NextRequest) {
  const target = new URL(upstream);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const authorization = request.headers.get('authorization');
  const forwardedFor = request.headers.get('x-forwarded-for');
  try {
    const response = await fetch(target, { headers: { accept: 'application/json', ...(authorization ? { authorization } : {}), ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) }, cache: 'no-store' });
    const body = await response.text();
    if (response.status === 401 && /Protected deployment|vercel_auth_enabled/i.test(body)) {
      return Response.json({ error: '数据服务仍被 Vercel 部署保护拦截，请在后端项目关闭 Deployment Protection 后重试。', code: 'BACKEND_DEPLOYMENT_PROTECTED' }, { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    return new Response(body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: '长视频数据服务暂时不可达，请稍后重试。' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
