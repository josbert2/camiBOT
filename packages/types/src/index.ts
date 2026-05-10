// Tipos compartidos bot ↔ web. Independientes de Prisma para no acoplar.

export type BracketFormat =
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'ROUND_ROBIN'
  | 'SWISS';

export type BracketSide = 'WINNERS' | 'LOSERS' | 'GRAND_FINAL';

export interface BracketSeed {
  participantId: string;
  seed: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  bracketSide: BracketSide;
  participant1Id: string | null;
  participant2Id: string | null;
  nextMatchId: string | null;
  loserNextMatchId: string | null;
}

// Discord interaction custom IDs (botones, menus)
export type CustomId =
  | `tournament:register:${string}`
  | `tournament:unregister:${string}`
  | `tournament:checkin:${string}`
  | `match:report:${string}:${'p1' | 'p2'}`
  | `match:dispute:${string}`;
