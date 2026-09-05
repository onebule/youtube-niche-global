import { NextRequest } from 'next/server';
import { clientErrorMessage } from '@/src/lib/client-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/longform-production';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: '请求格式无效。', code: 'INVALID_JSON' }, { status: 400 }); }
  try {
    if (body && typeof body === 'object' && (body as Record<string, unknown>).action === 'SAVE_TEST_PLAN') {
      // Old backends ignore unknown actions and may start LLM materialization.
      // Fail closed before POST, not after a paid side effect has happened.
      const probe = await fetch(`${upstream}?bridge=test-plan-v1`, {
        headers: { accept: 'application/json', ...(authorization ? { authorization } : {}) },
        cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      const capability = await probe.json().catch(() => null);
      if (!probe.ok || capability?.testPlanBridge !== 'v1' || capability?.saveOnly !== true) {
        return Response.json({ error: probe.status === 401 ? '请先登录后保存制作方案。' : '所选测试接入尚未部署到后端；已阻止提交，不会调用模型。', code: 'TEST_PLAN_BRIDGE_UNAVAILABLE' }, { status: probe.status === 401 ? 401 : 503 });
      }
    }
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try { const parsed: unknown = text ? JSON.parse(text) : null; if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>; } catch { /* keep a safe client error */ }
    if (!response.ok) return Response.json({ ...payload, error: clientErrorMessage(payload.error, `制作方案服务暂时不可用（HTTP ${response.status}）。`) }, { status: response.status, headers: { 'cache-control': 'no-store' } });
    return Response.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: '制作方案服务暂时不可达，请稍后重试。', code: 'PRODUCTION_MATERIALIZER_UNAVAILABLE' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
