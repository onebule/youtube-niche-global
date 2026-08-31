import { NextRequest } from 'next/server';
import { buildChannelDiagnosis, channelDoctorReportToInput } from '@/src/lib/channel-diagnostic-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = process.env.CHANNEL_DOCTOR_UPSTREAM || 'https://youtube-niche-global-api.vercel.app/api/channel-doctor';

export async function GET(request: NextRequest) {
  const target = new URL(upstream);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const headers: HeadersInit = { accept: 'application/json' };
  const authorization = request.headers.get('authorization');
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (authorization) headers.authorization = authorization;
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  try {
    const response = await fetch(target, { headers, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } });
    if (!payload || typeof payload !== 'object' || !payload.channel || !Array.isArray(payload.videos)) {
      return Response.json({ error: '频道诊断返回的数据结构不完整，无法生成 V3 诊断。', code: 'INVALID_CHANNEL_DOCTOR_PAYLOAD' }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }
    const diagnosisV3 = buildChannelDiagnosis(channelDoctorReportToInput(payload), new Date());
    return Response.json({ ...payload, diagnosisV3 }, { status: 200, headers: { 'cache-control': 'no-store', 'x-diagnosis-version': diagnosisV3.diagnosisVersion } });
  } catch {
    return Response.json({ error: '频道诊断服务暂时不可达，请稍后重试。', code: 'CHANNEL_DOCTOR_UPSTREAM_UNAVAILABLE' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
