import { prisma } from '@camibot/db';

export interface BracketContext {
  matchNumber: number;
  round: number;
  totalRounds: number;
  p1Name: string;
  p2Name: string;
}

/**
 * Carga toda la info necesaria para nombrar un VC: round, totalRounds del bracket,
 * y los nombres de ambos participantes.
 */
export async function getBracketContext(matchId: string): Promise<BracketContext | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      participant1: { include: { user: true } },
      participant2: { include: { user: true } },
      tournament: {
        include: {
          matches: { select: { round: true } },
        },
      },
    },
  });
  if (!match) return null;

  const totalRounds = match.tournament.matches.reduce((max, m) => Math.max(max, m.round), 1);

  return {
    matchNumber: match.matchNumber,
    round: match.round,
    totalRounds,
    p1Name:
      match.participant1?.user.globalName ?? match.participant1?.user.username ?? '?',
    p2Name:
      match.participant2?.user.globalName ?? match.participant2?.user.username ?? '?',
  };
}
