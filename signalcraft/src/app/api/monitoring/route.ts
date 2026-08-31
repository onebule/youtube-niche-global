import { NextRequest } from 'next/server';
import { clientErrorMessage } from '@/src/lib/client-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/monitoring';

async function proxy(request: NextRequest) {
  const target = new URL(upstream);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const authorization = request.headers.get('authorization');
  const forwardedFor = request.headers.get('x-forwarded-for');
  const init: RequestInit = {
    method: request.method,
    headers: { accept: 'application/json', ...(authorization ? { authorization } : {}), ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}), ...(request.method !== 'GET' && request.method !== 'DELETE' ? { 'content-type': 'application/json' } : {}) },
    cache: 'no-store',
  };
  if (request.method !== 'GET' && request.method !== 'DELETE') init.body = await request.text();
  try {
    const response = await fetch(target, init);
    const body = await response.text();
    if (!response.ok) {
      let payload: Record<string, unknown> = {};
      try {
        const parsed: unknown = body ? JSON.parse(body) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
      } catch {
        // Keep non-JSON upstream responses out of the user-facing error text.
      }
      return Response.json({ ...payload, error: clientErrorMessage(payload.error, `监控服务暂时不可用（HTTP ${response.status}）。`) }, { status: response.status, headers: { 'cache-control': 'no-store' } });
    }
    return new Response(body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: '监控服务暂时不可达，请稍后重试。' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}

export async function GET(request: NextRequest) { return proxy(request); }
export async function POST(request: NextRequest) { return proxy(request); }
export async function PATCH(request: NextRequest) { return proxy(request); }
export async function DELETE(request: NextRequest) { return proxy(request); }
