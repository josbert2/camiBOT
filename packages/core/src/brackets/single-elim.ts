import type { BracketSeed, BracketMatch } from '@camibot/types';
import { standardSeeding, nextPowerOfTwo } from './seeding.js';

export interface GenerateSingleElimInput {
  seeds: BracketSeed[]; // ordenados por seed (1, 2, 3, ...) — si no, los re-ordeno
}

/**
 * Genera un bracket single-elimination completo.
 *
 * - Pad con byes hasta la próxima potencia de 2.
 * - Top seed contra bye (avance automático).
 * - Cada match enlaza al siguiente vía `nextMatchId`.
 *
 * IDs: `m_r{round}_{matchNumber}`. Útiles antes de persistir; el llamador
 * los reemplaza por los CUIDs reales tras crear los registros.
 */
export function generateSingleElim({ seeds }: GenerateSingleElimInput): BracketMatch[] {
  if (seeds.length < 2) throw new Error('Single elim requires at least 2 participants');

  const sortedSeeds = [...seeds].sort((a, b) => a.seed - b.seed);
  const bracketSize = nextPowerOfTwo(sortedSeeds.length);
  const totalRounds = Math.log2(bracketSize);

  // Posiciones del bracket: para size=8 → [1,8,4,5,2,7,3,6]
  // posición i tiene al seed seedingOrder[i]; si no existe, queda bye.
  const seedingOrder = standardSeeding(bracketSize);
  const slots: (BracketSeed | null)[] = new Array(bracketSize).fill(null);
  for (let pos = 0; pos < bracketSize; pos++) {
    const seedNum = seedingOrder[pos]!;
    const seed = sortedSeeds.find((s) => s.seed === seedNum);
    slots[pos] = seed ?? null;
  }

  const matches: BracketMatch[] = [];
  let prevRoundMatches: BracketMatch[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / 2 ** round;
    const roundMatches: BracketMatch[] = [];

    for (let i = 0; i < matchesInRound; i++) {
      const id = `m_r${round}_${i + 1}`;
      let p1: string | null = null;
      let p2: string | null = null;

      if (round === 1) {
        p1 = slots[i * 2]?.participantId ?? null;
        p2 = slots[i * 2 + 1]?.participantId ?? null;
      }

      roundMatches.push({
        id,
        round,
        matchNumber: i + 1,
        bracketSide: 'WINNERS',
        participant1Id: p1,
        participant2Id: p2,
        nextMatchId: null,
        loserNextMatchId: null,
      });
    }

    // Enlazar prev → current: el ganador del match prev[i] va a current[floor(i/2)].
    if (prevRoundMatches.length > 0) {
      for (let i = 0; i < prevRoundMatches.length; i++) {
        prevRoundMatches[i]!.nextMatchId = roundMatches[Math.floor(i / 2)]!.id;
      }
    }

    matches.push(...roundMatches);
    prevRoundMatches = roundMatches;
  }

  // Avanzar byes: en round 1 si solo hay un participante, ese gana automático.
  for (const m of matches.filter((x) => x.round === 1)) {
    if (m.participant1Id && !m.participant2Id) advanceWinner(matches, m, m.participant1Id);
    else if (!m.participant1Id && m.participant2Id) advanceWinner(matches, m, m.participant2Id);
  }

  return matches;
}

function advanceWinner(matches: BracketMatch[], match: BracketMatch, winnerId: string) {
  if (!match.nextMatchId) return;
  const next = matches.find((m) => m.id === match.nextMatchId);
  if (!next) return;
  // El primer match prev en llegar ocupa p1, el segundo p2.
  if (!next.participant1Id) next.participant1Id = winnerId;
  else if (!next.participant2Id) next.participant2Id = winnerId;
}

/**
 * Aplica el resultado de un match: marca el ganador y avanza al siguiente match.
 * Mutación in-place sobre el array de matches.
 */
export function applyMatchResult(
  matches: BracketMatch[],
  matchId: string,
  winnerId: string,
): { advanced: boolean; nextMatchId: string | null } {
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`Match not found: ${matchId}`);
  if (match.participant1Id !== winnerId && match.participant2Id !== winnerId) {
    throw new Error(`Winner ${winnerId} not part of match ${matchId}`);
  }
  if (!match.nextMatchId) return { advanced: false, nextMatchId: null };
  advanceWinner(matches, match, winnerId);
  return { advanced: true, nextMatchId: match.nextMatchId };
}
