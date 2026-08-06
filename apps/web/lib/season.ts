import { prisma } from '@camibot/db';
import type { Season } from '@camibot/db';
import { discordAvatarUrl, type PostAuthor } from '@/lib/community';

/**
 * Temporadas de la comunidad. Los puntos de un usuario son los likes que
 * recibieron sus clips (publicados, no removidos) DENTRO del rango de la
 * temporada. Gana quien mas puntos tenga al cerrar.
 */

export type LeaderboardRow = {
  rank: number;
  user: PostAuthor;
  points: number; // likes recibidos (en la ventana de la temporada, o all-time)
  clips: number; // clips publicados por el usuario
};

export type SeasonStanding = {
  points: number;
  rank: number | null; // null si no tiene puntos todavia
  ranked: number; // cuantos usuarios tienen al menos 1 punto
};

const userSelect = {
  id: true,
  discordId: true,
  username: true,
  globalName: true,
  avatar: true,
} as const;

type RawUser = {
  id: string;
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

function toAuthor(u: RawUser): PostAuthor {
  return {
    id: u.id,
    name: u.globalName ?? u.username,
    username: u.username,
    avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
  };
}

/** La temporada activa (si hay). El admin controla el estado. */
export function getActiveSeason(): Promise<Season | null> {
  return prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startsAt: 'desc' },
  });
}

/** True si la temporada ya paso su fecha de cierre (esta lista para cerrar). */
export function isSeasonEnded(season: Season, now: Date): boolean {
  return now >= season.endsAt;
}

/** Puntos de un usuario en una temporada (likes recibidos en la ventana). */
export function getUserSeasonPoints(userId: string, season: Season): Promise<number> {
  return prisma.postLike.count({
    where: {
      createdAt: { gte: season.startsAt, lt: season.endsAt },
      post: { authorId: userId, removedAt: null, status: 'PUBLISHED' },
    },
  });
}

/**
 * Top N de la temporada, ordenado por puntos (likes en la ventana). Incluye a
 * TODOS los usuarios registrados (LEFT JOIN), así los de 0 puntos también salen.
 */
export async function getSeasonLeaderboard(
  season: Season,
  limit = 10,
): Promise<LeaderboardRow[]> {
  const rows = await prisma.$queryRaw<{ authorId: string; points: number }[]>`
    SELECT u.id AS "authorId", COUNT(l.id)::int AS points
    FROM "User" u
    LEFT JOIN "Post" p
      ON p."authorId" = u.id AND p."removedAt" IS NULL AND p."status" = 'PUBLISHED'
    LEFT JOIN "PostLike" l
      ON l."postId" = p.id AND l."createdAt" >= ${season.startsAt} AND l."createdAt" < ${season.endsAt}
    GROUP BY u.id
    ORDER BY points DESC, u.id ASC
    LIMIT ${limit}
  `;
  return hydrateRows(rows);
}

/**
 * Ranking all-time (sin ventana): todos los usuarios por likes recibidos
 * totales. Se usa en el sidebar cuando no hay temporada activa.
 */
export async function getAllTimeLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  const rows = await prisma.$queryRaw<{ authorId: string; points: number }[]>`
    SELECT u.id AS "authorId", COUNT(l.id)::int AS points
    FROM "User" u
    LEFT JOIN "Post" p
      ON p."authorId" = u.id AND p."removedAt" IS NULL AND p."status" = 'PUBLISHED'
    LEFT JOIN "PostLike" l ON l."postId" = p.id
    GROUP BY u.id
    ORDER BY points DESC, u.id ASC
    LIMIT ${limit}
  `;
  return hydrateRows(rows);
}

/** Suma usuario + conteo de clips a las filas crudas de puntos. */
async function hydrateRows(
  rows: { authorId: string; points: number }[],
): Promise<LeaderboardRow[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.authorId);
  const [users, clipGroups] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: userSelect }),
    prisma.post.groupBy({
      by: ['authorId'],
      where: { authorId: { in: ids }, removedAt: null, status: 'PUBLISHED' },
      _count: { _all: true },
    }),
  ]);

  const byId = new Map(users.map((u) => [u.id, u]));
  const clipsById = new Map(clipGroups.map((g) => [g.authorId, g._count._all]));

  return rows
    .map((r, i) => {
      const u = byId.get(r.authorId);
      if (!u) return null;
      return {
        rank: i + 1,
        user: toAuthor(u),
        points: r.points,
        clips: clipsById.get(r.authorId) ?? 0,
      };
    })
    .filter((r): r is LeaderboardRow => r !== null);
}

/** Posicion de un usuario en la temporada (para su perfil). */
export async function getUserStanding(
  userId: string,
  season: Season,
): Promise<SeasonStanding> {
  const points = await getUserSeasonPoints(userId, season);

  // Cuantos usuarios tienen al menos un punto, y cuantos superan al usuario.
  const agg = await prisma.$queryRaw<{ ranked: number; ahead: number }[]>`
    WITH scores AS (
      SELECT p."authorId", COUNT(*)::int AS points
      FROM "PostLike" l
      JOIN "Post" p ON p.id = l."postId"
      WHERE l."createdAt" >= ${season.startsAt}
        AND l."createdAt" < ${season.endsAt}
        AND p."removedAt" IS NULL
        AND p."status" = 'PUBLISHED'
      GROUP BY p."authorId"
    )
    SELECT
      (SELECT COUNT(*)::int FROM scores) AS ranked,
      (SELECT COUNT(*)::int FROM scores WHERE points > ${points}) AS ahead
  `;

  const ranked = agg[0]?.ranked ?? 0;
  const ahead = agg[0]?.ahead ?? 0;

  return {
    points,
    rank: points > 0 ? ahead + 1 : null,
    ranked,
  };
}

/** Cierra una temporada y fija al ganador (el de mas puntos). */
export async function closeSeason(seasonId: string): Promise<Season> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error('Temporada inexistente.');
  if (season.status === 'CLOSED') return season;

  const top = await getSeasonLeaderboard(season, 1);
  const winner = top[0] && top[0].points > 0 ? top[0] : null;

  return prisma.season.update({
    where: { id: seasonId },
    data: {
      status: 'CLOSED',
      winnerId: winner?.user.id ?? null,
      winnerPoints: winner?.points ?? null,
    },
  });
}
