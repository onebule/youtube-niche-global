import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://niqivo.top';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = ['/', '/discover', '/rankings', '/radar', '/doctor', '/methodology', '/pricing'];

  return publicRoutes.map(path => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'hourly',
    priority: path === '/' ? 1 : path === '/rankings' || path === '/discover' ? 0.9 : 0.7,
  }));
}
