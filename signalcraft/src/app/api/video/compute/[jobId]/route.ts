import { NextRequest } from 'next/server';
import { createComputeBroker } from '@/src/lib/compute-broker/broker.ts';
import { readComputeBrokerConfig } from '@/src/lib/compute-broker/config.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!readComputeBrokerConfig().enabled) return Response.json({ code: 'COMPUTE_BROKER_DISABLED', error: 'Compute Broker 当前关闭。' }, { status: 404 });
  const { jobId } = await context.params;
  const job = await createComputeBroker().getJob(jobId);
  return job ? Response.json({ job, ...(job.error?.details?.publicCode ? { code: job.error.details.publicCode } : {}) }, { headers: { 'cache-control': 'no-store' } }) : Response.json({ code: 'JOB_NOT_FOUND', error: '算力任务不存在。' }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!readComputeBrokerConfig().enabled) return Response.json({ code: 'COMPUTE_BROKER_DISABLED', error: 'Compute Broker 当前关闭。' }, { status: 404 });
  const { jobId } = await context.params;
  const action = request.nextUrl.searchParams.get('action') || 'cancel';
  if (action !== 'cancel') return Response.json({ code: 'INVALID_ACTION', error: '只支持 action=cancel。' }, { status: 422 });
  const job = await createComputeBroker().cancel(jobId, { authorization: request.headers.get('authorization') });
  return job ? Response.json({ job }, { headers: { 'cache-control': 'no-store' } }) : Response.json({ code: 'JOB_NOT_FOUND', error: '算力任务不存在。' }, { status: 404 });
}
