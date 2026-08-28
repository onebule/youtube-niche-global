import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://niqivo.top';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app/', '/owner', '/login', '/api/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
