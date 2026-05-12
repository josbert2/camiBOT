import type { BracketSeed, BracketMatch } from '@camibot/types';
import { standardSeeding, nextPowerOfTwo } from './seeding';

export interface GenerateDoubleElimInput {
  seeds: BracketSeed[];
  /** Si true, agrega un match adicional de "reset" cuando el ganador del losers gana la GF. Default true. */
  grandFinalReset?: boolean;
}

/**
 * Genera un bracket double-elimination.
 *
 * Estructura:
 *   - Winners (WB): igual que single-elim. Pierdes una → caes a Losers.
 *   - Losers (LB): pierdes la segunda → eliminado. Tiene 2*(log2(N)-1) rondas.
 *   - Grand Final (GF): ganador WB vs ganador LB.
 *   - GF Reset: si el ganador LB gana la GF, se juega un match más
 *     (porque el de WB venía invicto). Opcional.
 *
 * Routing LB típico:
 *   - L_R1: perdedores de W_R1 entre sí.
 *   - L_R2 (minor): ganador de L_R1 vs perdedor de W_R2.
 *   - L_R3 (major): ganadores de L_R2 entre sí.
 *   - L_R4 (minor): ganador de L_R3 vs perdedor de W_R3.
 *   - ... hasta L_F: 1 match, losers final.
 *
 * IDs:
 *   - Winners:        `de_w_r{r}_m{n}`
 *   - Losers:         `de_l_r{r}_m{n}`
 *   - Grand Final:    `de_gf`
 *   - GF Reset:       `de_gfr` (solo si grandFinalReset)
 *
 * Restricción: N debe ser potencia de 2 (2, 4, 8, 16, ...). Sin soporte de byes
 * en double elim (el routing del LB con byes es ambiguo).
 */
export function generateDoubleElim({
  seeds,
  grandFinalReset = true,
}: GenerateDoubleElimInput): BracketMatch[] {
  if (seeds.length < 2) throw new Error('Double elim requires at least 2 participants');
  if (seeds.length !== nextPowerOfTwo(seeds.length)) {
    throw new Error(
      `Double elim necesita un número potencia de 2 de participantes (got ${seeds.length})`,
    );
  }

  const sortedSeeds = [...seeds].sort((a, b) => a.seed - b.seed);
  const n = sortedSeeds.length;
  const wbRounds = Math.log2(n);
  const lbRounds = 2 * (wbRounds - 1);

  // ============================================================
  // 1) Winners bracket: idéntico al single-elim
  // ============================================================
  const seedingOrder = standardSeeding(n);
  const slots = seedingOrder.map((seedNum) =>
    sortedSeeds.find((s) => s.seed === seedNum)?.participantId ?? null,
  );

  const wbMatches: BracketMatch[] = [];
  for (let r = 1; r <= wbRounds; r++) {
    const matchesInRound = n / 2 ** r;
    for (let i = 0; i < matchesInRound; i++) {
      const id = `de_w_r${r}_m${i + 1}`;
      let p1: string | null = null;
      let p2: string | null = null;
      if (r === 1) {
        p1 = slots[i * 2] ?? null;
        p2 = slots[i * 2 + 1] ?? null;
      }
      wbMatches.push({
        id,
        round: r,
        matchNumber: i + 1,
        bracketSide: 'WINNERS',
        participant1Id: p1,
        participant2Id: p2,
        nextMatchId: null,
        loserNextMatchId: null,
      });
    }
  }

  // Enlazo prev → next en winners (igual single-elim).
  for (let r = 1; r < wbRounds; r++) {
    const prev = wbMatches.filter((m) => m.round === r);
    const curr = wbMatches.filter((m) => m.round === r + 1);
    for (let i = 0; i < prev.length; i++) {
      prev[i]!.nextMatchId = curr[Math.floor(i / 2)]!.id;
    }
  }

  // ============================================================
  // 2) Losers bracket
  // ============================================================
  // Cantidad de matches por ronda en LB:
  //   - L_R1 (major): n/4
  //   - L_R2 (minor): n/4
  //   - L_R3 (major): n/8
  //   - L_R4 (minor): n/8
  //   - ...
  //   - L_R{lbRounds} (final LB): 1
  // En general: round impar (1, 3, 5, ...) = n / 2^(r/2 + 1.5)... más fácil enumerarlas:
  const lbMatches: BracketMatch[] = [];
  const lbCounts: number[] = [];
  let cur = n / 4;
  for (let r = 1; r <= lbRounds; r++) {
    if (r === 1) {
      lbCounts.push(cur);
    } else if (r % 2 === 0) {
      // minor round: mismo count que el major previo
      lbCounts.push(cur);
    } else {
      // major round (después del primer): la mitad del minor previo
      cur = cur / 2;
      lbCounts.push(cur);
    }
  }

  for (let r = 1; r <= lbRounds; r++) {
    for (let i = 0; i < lbCounts[r - 1]!; i++) {
      lbMatches.push({
        id: `de_l_r${r}_m${i + 1}`,
        round: r,
        matchNumber: i + 1,
        bracketSide: 'LOSERS',
        participant1Id: null,
        participant2Id: null,
        nextMatchId: null,
        loserNextMatchId: null,
      });
    }
  }

  // ============================================================
  // 3) Routing: a) WB losers caen a LB
  // ============================================================
  // L_R1: perdedores de W_R1 (n/2 perdedores) van a n/4 matches LB R1.
  // L_R(2k) [minor]: perdedores de W_R(k+1) caen acá, contra ganadores de L_R(2k-1).
  const wbR1 = wbMatches.filter((m) => m.round === 1);
  const lbR1 = lbMatches.filter((m) => m.round === 1);
  for (let i = 0; i < wbR1.length; i++) {
    wbR1[i]!.loserNextMatchId = lbR1[Math.floor(i / 2)]!.id;
  }
  // WB ronda k > 1: perdedores van a LB ronda 2*(k-1) (la "minor" round).
  for (let k = 2; k <= wbRounds; k++) {
    const wbRound = wbMatches.filter((m) => m.round === k);
    const lbRoundIdx = 2 * (k - 1);
    if (lbRoundIdx > lbRounds) continue;
    const lbRound = lbMatches.filter((m) => m.round === lbRoundIdx);
    for (let i = 0; i < wbRound.length; i++) {
      wbRound[i]!.loserNextMatchId = lbRound[i]!.id;
    }
  }

  // ============================================================
  // 4) Routing: b) Avance dentro del LB
  // ============================================================
  // L_R(odd): los ganadores avanzan al match correspondiente de la próxima ronda (minor).
  //           El match LB i va a la próxima ronda en la posición floor(i/2) si es major→major,
  //           pero acá es major→minor 1:1 cuando los counts son iguales.
  //           Cuando r y r+1 tienen el mismo count → ganadores van 1:1.
  //           Cuando r+1 tiene la mitad de matches → ganadores van pareados (floor(i/2)).
  for (let r = 1; r < lbRounds; r++) {
    const here = lbMatches.filter((m) => m.round === r);
    const next = lbMatches.filter((m) => m.round === r + 1);
    if (here.length === next.length) {
      // Mismo count: avance 1:1 (major→minor, donde el perdedor del WB entra como otro slot).
      for (let i = 0; i < here.length; i++) {
        here[i]!.nextMatchId = next[i]!.id;
      }
    } else {
      // next tiene la mitad: pareamos (minor→major).
      for (let i = 0; i < here.length; i++) {
        here[i]!.nextMatchId = next[Math.floor(i / 2)]!.id;
      }
    }
  }

  // ============================================================
  // 5) Grand Final
  // ============================================================
  const gf: BracketMatch = {
    id: 'de_gf',
    round: wbRounds + 1, // representativa: 1 después de la WB final
    matchNumber: 1,
    bracketSide: 'GRAND_FINAL',
    participant1Id: null,
    participant2Id: null,
    nextMatchId: null,
    loserNextMatchId: null,
  };

  const wbFinal = wbMatches.find((m) => m.round === wbRounds)!;
  const lbFinal = lbMatches.find((m) => m.round === lbRounds)!;
  wbFinal.nextMatchId = gf.id;
  lbFinal.nextMatchId = gf.id;

  let gfReset: BracketMatch | null = null;
  if (grandFinalReset) {
    gfReset = {
      id: 'de_gfr',
      round: wbRounds + 2,
      matchNumber: 1,
      bracketSide: 'GRAND_FINAL',
      participant1Id: null,
      participant2Id: null,
      nextMatchId: null,
      loserNextMatchId: null,
    };
    gf.nextMatchId = gfReset.id;
  }

  return [...wbMatches, ...lbMatches, gf, ...(gfReset ? [gfReset] : [])];
}

/**
 * Aplica el resultado de un match en double-elim: avanza ganador y, si corresponde,
 * baja al perdedor al LB.
 *
 * En GF: si el ganador venía del WB → torneo termina (no se juega reset).
 *        si el ganador venía del LB → se juega el reset (si existe).
 */
export function applyDoubleElimResult(
  matches: BracketMatch[],
  matchId: string,
  winnerId: string,
): { winnerAdvancedTo: string | null; loserDroppedTo: string | null; tournamentEnds: boolean } {
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`Match ${matchId} no encontrado`);
  if (!match.participant1Id || !match.participant2Id) {
    throw new Error(`Match ${matchId} no tiene los dos participantes`);
  }
  if (winnerId !== match.participant1Id && winnerId !== match.participant2Id) {
    throw new Error(`Winner ${winnerId} no pertenece al match ${matchId}`);
  }
  const loserId =
    winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;

  // Avance del ganador
  let winnerAdvancedTo: string | null = null;
  if (match.nextMatchId) {
    const next = matches.find((m) => m.id === match.nextMatchId)!;
    // En GF: si el winner viene de WB (es decir, su id en GF era p1 históricamente),
    // y gana → no hay reset. Si el winner viene de LB (p2 en GF) y gana → vamos a reset.
    // Convención: en GF, p1 = WB winner, p2 = LB winner (lo seteamos al popular GF).
    if (match.bracketSide === 'GRAND_FINAL' && match.id === 'de_gf') {
      const wbWinnerId = match.participant1Id;
      if (winnerId === wbWinnerId) {
        // WB winner ganó → torneo termina
        return { winnerAdvancedTo: null, loserDroppedTo: null, tournamentEnds: true };
      } else {
        // LB winner ganó → reset (si existe)
        if (next.id === 'de_gfr') {
          // Popular reset: ambos jugadores, intercambiando perspectiva
          if (!next.participant1Id) next.participant1Id = wbWinnerId;
          if (!next.participant2Id) next.participant2Id = winnerId;
          winnerAdvancedTo = next.id;
        }
      }
    } else if (match.bracketSide === 'GRAND_FINAL' && match.id === 'de_gfr') {
      return { winnerAdvancedTo: null, loserDroppedTo: null, tournamentEnds: true };
    } else {
      if (!next.participant1Id) next.participant1Id = winnerId;
      else if (!next.participant2Id) next.participant2Id = winnerId;
      winnerAdvancedTo = next.id;
    }
  }

  // Bajada del perdedor (solo en WB)
  let loserDroppedTo: string | null = null;
  if (match.loserNextMatchId) {
    const ld = matches.find((m) => m.id === match.loserNextMatchId)!;
    if (!ld.participant1Id) ld.participant1Id = loserId;
    else if (!ld.participant2Id) ld.participant2Id = loserId;
    loserDroppedTo = ld.id;
  }

  return { winnerAdvancedTo, loserDroppedTo, tournamentEnds: false };
}
