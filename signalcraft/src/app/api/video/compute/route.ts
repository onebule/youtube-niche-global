import { NextRequest } from 'next/server';
import { ComputeRequestError, ProviderError } from '@/src/lib/compute-broker/types.ts';
import { createComputeBroker } from '@/src/lib/compute-broker/broker.ts';
import { readComputeBrokerConfig } from '@/src/lib/compute-broker/config.ts';
import { parseVideoComputeRequest } from '@/src/lib/compute-broker/validation.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusForReason = (reason: ProviderError['reason']) => reason === 'BUDGET_EXCEEDED' ? 402 : reason === 'AUTH_ERROR' ? 401 : 503;

export async function POST(request: NextRequest) {
  const config = readComputeBrokerConfig();
  if (!config.enabled) return Response.json({ code: 'COMPUTE_BROKER_DISABLED', error: 'Compute Broker 当前关闭，旧视频生成流程未改变。' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ code: 'INVALID_INPUT', error: '请求体不是有效 JSON。' }, { status: 422 }); }
  try {
    const input = parseVideoComputeRequest(body, request.headers.get('x-request-id') || crypto.randomUUID());
    const broker = createComputeBroker();
    const result = await broker.submit(input, { authorization: request.headers.get('authorization') });
    return Response.json(result, { status: 202, headers: { 'cache-control': 'no-store', 'x-request-id': input.requestId } });
  } catch (error) {
    if (error instanceof ComputeRequestError) return Response.json({ code: error.reason, error: error.message }, { status: error.reason === 'UNSUPPORTED_WORKFLOW' ? 422 : 422 });
    if (error instanceof ProviderError) return Response.json({ code: error.reason, error: error.message, retryable: error.retryable }, { status: statusForReason(error.reason) });
    return Response.json({ code: 'COMPUTE_BROKER_ERROR', error: '算力路由暂时不可用。' }, { status: 500 });
  }
}
