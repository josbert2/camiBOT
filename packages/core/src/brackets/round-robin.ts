import type { BracketSeed, BracketMatch } from '@camibot/types';

export interface GenerateRoundRobinInput {
  seeds: BracketSeed[];
  /** Si true, cada par se juega dos veces (ida + vuelta). Default false. */
  doubleRound?: boolean;
}

/**
 * Genera un torneo round-robin (todos contra todos) usando el método circular.
 *
 * - Con N participantes par: N-1 rondas, N/2 matches por ronda, N*(N-1)/2 matches en total.
 * - Con N impar: agregamos un bye dummy y los matches contra bye se omiten (un jugador
 *   descansa por ronda).
 * - Si `doubleRound`, duplicamos invirtiendo p1↔p2 en cada repetición.
 *
 * No hay `nextMatchId` — los matches son independientes. El "ganador" del torneo
 * se determina al cerrar todas las rondas, mirando la tabla de posiciones.
 *
 * IDs: `rr_r{round}_{matchNumber}` (o `rrb` con `r{round + (N-1)}` para vuelta).
 */
export function generateRoundRobin({
  seeds,
  doubleRound = false,
}: GenerateRoundRobinInput): BracketMatch[] {
  if (seeds.length < 2) throw new Error('Round robin requires at least 2 participants');

  const sortedSeeds = [...seeds].sort((a, b) => a.seed - b.seed);
  const n = sortedSeeds.length;
  const isOdd = n % 2 === 1;
  const slots: (string | null)[] = sortedSeeds.map((s) => s.participantId);
  if (isOdd) slots.push(null); // bye

  const size = slots.length;
  const totalRounds = size - 1;
  const half = size / 2;

  const matches: BracketMatch[] = [];

  // Round-robin clásico: el slot[0] es fijo, los demás rotan.
  // Para cada ronda r, pareamos slots[i] con slots[size - 1 - i].
  // Luego rotamos slots[1..] una posición a la derecha.
  let rotating = slots.slice(1);

  for (let r = 1; r <= totalRounds; r++) {
    const round = [slots[0]!, ...rotating];
    let matchNumber = 0;
    for (let i = 0; i < half; i++) {
      const p1 = round[i]!;
      const p2 = round[size - 1 - i]!;
      if (p1 === null || p2 === null) continue; // bye → un jugador descansa
      matchNumber++;
      matches.push({
        id: `rr_r${r}_${matchNumber}`,
        round: r,
        matchNumber,
        bracketSide: 'WINNERS',
        participant1Id: p1,
        participant2Id: p2,
        nextMatchId: null,
        loserNextMatchId: null,
      });
    }
    // Rotación: último al frente.
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }

  if (doubleRound) {
    const firstRound = matches.length;
    for (let i = 0; i < firstRound; i++) {
      const m = matches[i]!;
      matches.push({
        id: `rr_r${m.round + totalRounds}_${m.matchNumber}`,
        round: m.round + totalRounds,
        matchNumber: m.matchNumber,
        bracketSide: 'WINNERS',
        // Invertimos p1↔p2 en la vuelta para que el "local" cambie.
        participant1Id: m.participant2Id,
        participant2Id: m.participant1Id,
        nextMatchId: null,
        loserNextMatchId: null,
      });
    }
  }

  return matches;
}

export interface RoundRobinStanding {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface CompletedRoundRobinMatch {
  participant1Id: string;
  participant2Id: string;
  winnerId: string;
}

/**
 * Calcula la tabla de posiciones a partir de los matches completados.
 *
 * Sistema de puntos default: 3 por victoria, 0 por derrota.
 * (Sin draws — el modelo Match actual no los soporta.)
 *
 * Empate de puntos se resuelve por: 1) más wins, 2) menos losses, 3) orden alfabético.
 */
export function computeStandings(
  participantIds: string[],
  completed: CompletedRoundRobinMatch[],
  pointsPerWin = 3,
): RoundRobinStanding[] {
  const standings = new Map<string, RoundRobinStanding>(
    participantIds.map((id) => [
      id,
      { participantId: id, played: 0, wins: 0, losses: 0, points: 0 },
    ]),
  );

  for (const m of completed) {
    const s1 = standings.get(m.participant1Id);
    const s2 = standings.get(m.participant2Id);
    if (!s1 || !s2) continue;
    s1.played++;
    s2.played++;
    if (m.winnerId === m.participant1Id) {
      s1.wins++;
      s1.points += pointsPerWin;
      s2.losses++;
    } else if (m.winnerId === m.participant2Id) {
      s2.wins++;
      s2.points += pointsPerWin;
      s1.losses++;
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.participantId.localeCompare(b.participantId);
  });
}
