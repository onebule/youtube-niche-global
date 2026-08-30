const upstream = 'https://youtube-niche-global-api.vercel.app/api/auth';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求格式不正确。', code: 'AUTH_REQUEST_INVALID' }, { status: 400 });
  }

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { 'cache-control': 'no-store', 'content-type': response.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return Response.json({ error: '认证服务暂时不可用，请稍后重试。', code: 'AUTH_NETWORK_ERROR' }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
