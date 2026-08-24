import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const upstream = 'https://youtube-niche-global-api.vercel.app/api/owner-access';

async function forward(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: await request.text(),
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
      { error: '账号授权服务暂时不可达，请稍后重试。' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function POST(request: NextRequest) { return forward(request); }
export async function DELETE(request: NextRequest) { return forward(request); }
