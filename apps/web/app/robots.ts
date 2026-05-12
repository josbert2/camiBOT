import type { MetadataRoute } from 'next';

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/players', '/comandos', '/t/'],
        disallow: ['/api/', '/dashboard', '/admin', '/login'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
