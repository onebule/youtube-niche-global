import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'niqivo.top';
const LEGACY_HOSTS = new Set([
  'youtube-niche-global.vercel.app',
  'www.youtube-niche-global.vercel.app',
]);

/**
 * Keep shared links, OAuth returns, and search indexes on the custom domain.
 * The API remains a separate service, so only legacy frontend hosts are
 * redirected here. Pathnames and query strings are preserved verbatim.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  if (!host || !LEGACY_HOSTS.has(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = CANONICAL_HOST;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
