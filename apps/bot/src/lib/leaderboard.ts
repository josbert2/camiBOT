import { prisma } from '@camibot/db';
import { logger } from './logger.js';

/**
 * Sistema de puntos default cuando se completa un torneo:
 *   - Campeón (status WINNER): +CHAMPION_POINTS
 *   - Cada win individual del torneo: +WIN_POINTS
 *   - Participar al menos un match: +PARTICIPATION_POINTS
 *
 * Los puntos se acumulan en LeaderboardEntry (por usuario) dentro del
 * Leaderboard default del guild (creado lazy).
 */
const CHAMPION_POINTS = 10;
const WIN_POINTS = 3;
const PARTICIPATION_POINTS = 1;

const DEFAULT_LEADERBOARD_NAME = 'General';

async function getOrCreateDefaultLeaderboard(guildId: string) {
  const existing = await prisma.leaderboard.findFirst({
    where: { guildId, name: DEFAULT_LEADERBOARD_NAME, gameId: null },
  });
  if (existing) return existing;
  return prisma.leaderboard.create({
    data: {
      guildId,
      name: DEFAULT_LEADERBOARD_NAME,
      config: {
        championPoints: CHAMPION_POINTS,
        winPoints: WIN_POINTS,
        participationPoints: PARTICIPATION_POINTS,
      },
    },
  });
}

export async function updateLeaderboardForCompletedTournament(
  tournamentId: string,
): Promise<void> {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { select: { id: true, userId: true, wins: true, status: true } },
      },
    });
    if (!tournament || tournament.status !== 'COMPLETED') return;

    const leaderboard = await getOrCreateDefaultLeaderboard(tournament.guildId);

    for (const p of tournament.participants) {
      const isChampion = p.status === 'WINNER';
      const points =
        (isChampion ? CHAMPION_POINTS : 0) +
        p.wins * WIN_POINTS +
        PARTICIPATION_POINTS;

      await prisma.leaderboardEntry.upsert({
        where: {
          leaderboardId_userId: {
            leaderboardId: leaderboard.id,
            userId: p.userId,
          },
        },
        create: {
          leaderboardId: leaderboard.id,
          userId: p.userId,
          points,
          wins: p.wins,
          losses: 0, // se actualiza abajo
          tournamentsPlayed: 1,
          tournamentsWon: isChampion ? 1 : 0,
        },
        update: {
          points: { increment: points },
          wins: { increment: p.wins },
          tournamentsPlayed: { increment: 1 },
          tournamentsWon: isChampion ? { increment: 1 } : undefined,
        },
      });
    }

    // Update losses por separado (es más fácil que en el upsert)
    for (const p of tournament.participants) {
      const losses = await prisma.match
        .count({
          where: {
            tournamentId,
            status: 'COMPLETED',
            OR: [
              { participant1Id: p.id, NOT: { winnerId: p.id } },
              { participant2Id: p.id, NOT: { winnerId: p.id } },
            ],
          },
        })
        .catch(() => 0);
      if (losses > 0) {
        await prisma.leaderboardEntry.update({
          where: {
            leaderboardId_userId: {
              leaderboardId: leaderboard.id,
              userId: p.userId,
            },
          },
          data: { losses: { increment: losses } },
        });
      }
    }

    logger.info(
      { tournamentId, leaderboardId: leaderboard.id, participants: tournament.participants.length },
      'Leaderboard updated',
    );
  } catch (err) {
    logger.error({ err, tournamentId }, 'Fallo actualizando leaderboard');
  }
}
