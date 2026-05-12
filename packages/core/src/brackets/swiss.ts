import type { BracketSeed, BracketMatch } from '@camibot/types';

/**
 * Sistema Suizo
 * ---------------
 * - Todos juegan TODAS las rondas (sin eliminación).
 * - Cada ronda: ganadores se emparejan con ganadores, perdedores con perdedores.
 * - N rondas = ceil(log2(participantes)) por default.
 * - Si N es impar, el último de cada ronda recibe "bye" (gana automáticamente +1 punto).
 * - Final: ranking por puntos (3 por win, 0 por loss).
 *
 * IDs: `sw_r{round}_m{matchNumber}`. Los matches se generan ronda por ronda
 * (no todos al inicio como round-robin), porque cada emparejamiento depende
 * del resultado del anterior.
 */

export interface SwissParticipant {
  participantId: string;
  seed: number;
  points: number;
  /** Lista de oponentes ya enfrentados (para evitar rematches) */
  opponents: string[];
  /** Si ya recibió bye en una ronda previa (evita doble bye) */
  hadBye: boolean;
}

export interface CompletedSwissMatch {
  participant1Id: string;
  participant2Id: string;
  winnerId: string;
}

export function defaultSwissRounds(numParticipants: number): number {
  if (numParticipants < 2) return 0;
  return Math.max(1, Math.ceil(Math.log2(numParticipants)));
}

/**
 * Genera los matches de la primera ronda. Empareja por seed: el top
 * con el del medio (1 vs N/2+1), evita que dos top se enfrenten temprano.
 */
export function generateSwissRoundOne(
  seeds: BracketSeed[],
): BracketMatch[] {
  if (seeds.length < 2) throw new Error('Swiss requires at least 2 participants');
  const sorted = [...seeds].sort((a, b) => a.seed - b.seed);
  const n = sorted.length;
  const half = Math.floor(n / 2);
  const matches: BracketMatch[] = [];

  for (let i = 0; i < half; i++) {
    const p1 = sorted[i]!;
    const p2 = sorted[i + half]!;
    matches.push({
      id: `sw_r1_m${i + 1}`,
      round: 1,
      matchNumber: i + 1,
      bracketSide: 'WINNERS',
      participant1Id: p1.participantId,
      participant2Id: p2.participantId,
      nextMatchId: null,
      loserNextMatchId: null,
    });
  }

  // Si N impar: el último (peor seed que no fue emparejado) recibe BYE.
  // Lo representamos como un match con un solo participante; el caller
  // marca a este como ganador automático al persistir.
  if (n % 2 === 1) {
    const lastUnpaired = sorted[n - 1]!;
    matches.push({
      id: `sw_r1_m${half + 1}`,
      round: 1,
      matchNumber: half + 1,
      bracketSide: 'WINNERS',
      participant1Id: lastUnpaired.participantId,
      participant2Id: null,
      nextMatchId: null,
      loserNextMatchId: null,
    });
  }

  return matches;
}

/**
 * Genera los matches de la siguiente ronda. Usa Swiss pairing:
 *
 * 1. Ordena participantes por puntos desc, seed asc como desempate.
 * 2. Recorre de mayor a menor: cada participante busca al próximo que
 *    NO haya enfrentado todavía. Si todos los siguientes ya jugaron contra él,
 *    toma el primer disponible (fallback).
 * 3. Si N impar, el último (con menos puntos sin bye previo) recibe bye.
 */
export function generateNextSwissRound(
  participants: SwissParticipant[],
  newRoundNumber: number,
): BracketMatch[] {
  if (participants.length < 2) return [];

  const ordered = [...participants].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.seed - b.seed;
  });

  const used = new Set<string>();
  const matches: BracketMatch[] = [];
  let matchCount = 0;

  // Bye candidate: el de menor puntos que NO haya tenido bye previo
  let byeCandidate: SwissParticipant | null = null;
  if (ordered.length % 2 === 1) {
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (!ordered[i]!.hadBye) {
        byeCandidate = ordered[i]!;
        break;
      }
    }
    // Si todos tuvieron bye, le damos al de menor puntos igual
    if (!byeCandidate) byeCandidate = ordered[ordered.length - 1]!;
    used.add(byeCandidate.participantId);
  }

  for (let i = 0; i < ordered.length; i++) {
    const p1 = ordered[i]!;
    if (used.has(p1.participantId)) continue;

    // Buscar oponente: preferentemente alguien con puntos similares
    // que NO haya enfrentado. Si no hay, primero disponible.
    let opponent: SwissParticipant | null = null;
    for (let j = i + 1; j < ordered.length; j++) {
      const candidate = ordered[j]!;
      if (used.has(candidate.participantId)) continue;
      if (p1.opponents.includes(candidate.participantId)) continue;
      opponent = candidate;
      break;
    }
    // Fallback: primer disponible aunque sea rematch
    if (!opponent) {
      for (let j = i + 1; j < ordered.length; j++) {
        const candidate = ordered[j]!;
        if (!used.has(candidate.participantId)) {
          opponent = candidate;
          break;
        }
      }
    }
    if (!opponent) break;

    used.add(p1.participantId);
    used.add(opponent.participantId);
    matchCount++;
    matches.push({
      id: `sw_r${newRoundNumber}_m${matchCount}`,
      round: newRoundNumber,
      matchNumber: matchCount,
      bracketSide: 'WINNERS',
      participant1Id: p1.participantId,
      participant2Id: opponent.participantId,
      nextMatchId: null,
      loserNextMatchId: null,
    });
  }

  // Match bye (si aplica)
  if (byeCandidate) {
    matchCount++;
    matches.push({
      id: `sw_r${newRoundNumber}_m${matchCount}`,
      round: newRoundNumber,
      matchNumber: matchCount,
      bracketSide: 'WINNERS',
      participant1Id: byeCandidate.participantId,
      participant2Id: null,
      nextMatchId: null,
      loserNextMatchId: null,
    });
  }

  return matches;
}

export interface SwissStanding {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Buchholz: suma de puntos de oponentes (desempate típico de Suizo) */
  buchholz: number;
}

/**
 * Calcula standings finales. Sort: puntos desc, Buchholz desc.
 */
export function computeSwissStandings(
  participantIds: string[],
  completed: CompletedSwissMatch[],
  pointsPerWin = 3,
): SwissStanding[] {
  const stats = new Map<string, SwissStanding>(
    participantIds.map((id) => [
      id,
      {
        participantId: id,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        buchholz: 0,
      },
    ]),
  );
  // Tracker de oponentes para Buchholz
  const opponentsOf = new Map<string, string[]>(participantIds.map((id) => [id, []]));

  for (const m of completed) {
    const s1 = stats.get(m.participant1Id);
    const s2 = stats.get(m.participant2Id);
    if (!s1 || !s2) continue;
    s1.played++;
    s2.played++;
    opponentsOf.get(s1.participantId)!.push(s2.participantId);
    opponentsOf.get(s2.participantId)!.push(s1.participantId);
    if (m.winnerId === s1.participantId) {
      s1.wins++;
      s1.points += pointsPerWin;
      s2.losses++;
    } else if (m.winnerId === s2.participantId) {
      s2.wins++;
      s2.points += pointsPerWin;
      s1.losses++;
    }
  }

  // Buchholz
  for (const [id, opps] of opponentsOf) {
    const s = stats.get(id)!;
    s.buchholz = opps.reduce((sum, oppId) => sum + (stats.get(oppId)?.points ?? 0), 0);
  }

  return [...stats.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.participantId.localeCompare(b.participantId);
  });
}
