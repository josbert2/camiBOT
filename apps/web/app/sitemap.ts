import type { MetadataRoute } from 'next';
import { prisma } from '@camibot/db';

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${SITE_URL}/players`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/comandos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
      select: { id: true, updatedAt: true },
      take: 5000,
      orderBy: { updatedAt: 'desc' },
    });
    const players = await prisma.user.findMany({
      where: { participations: { some: {} } },
      select: { id: true, updatedAt: true },
      take: 5000,
    });
    const guilds = await prisma.guild.findMany({
      select: { id: true, updatedAt: true },
      take: 1000,
    });

    return [
      ...staticPages,
      ...tournaments.map((t) => ({
        url: `${SITE_URL}/t/${t.id}`,
        lastModified: t.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...players.map((p) => ({
        url: `${SITE_URL}/players/${p.id}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...guilds.map((g) => ({
        url: `${SITE_URL}/leaderboard/${g.id}`,
        lastModified: g.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ];
  } catch {
    // Si la DB no está disponible al build-time, devolvemos solo las estáticas.
    return staticPages;
  }
}
