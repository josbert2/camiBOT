import type { BracketMatch } from '@camibot/types';

export interface RenderOptions {
  /** Función para resolver el nombre visible de un participante. */
  getName: (participantId: string) => string;
  /** Score por match (opcional). Si se pasa, se renderiza al lado del nombre. */
  getScore?: (matchId: string) => { p1: number; p2: number } | null;
  /** Labels custom de rondas. Default: "Round N", última = "Final", penúltima = "Semifinal". */
  roundLabel?: (round: number, totalRounds: number) => string;
}

const TBD = '[TBD]';
const BYE = '[BYE]';

export function renderBracketText(matches: BracketMatch[], opts: RenderOptions): string {
  if (matches.length === 0) return '_(sin matches)_';

  const totalRounds = Math.max(...matches.map((m) => m.round));
  const byRound = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  const lines: string[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const round = byRound.get(r) ?? [];
    round.sort((a, b) => a.matchNumber - b.matchNumber);

    const label = opts.roundLabel?.(r, totalRounds) ?? defaultRoundLabel(r, totalRounds);
    lines.push(`**${label}**`);

    for (const match of round) {
      const p1 = formatSide(match.participant1Id, opts.getName);
      const p2 = formatSide(match.participant2Id, opts.getName);
      const scores = opts.getScore?.(match.id);
      const scoreStr = scores ? ` \`${scores.p1}-${scores.p2}\`` : '';
      lines.push(`  M${match.matchNumber}: ${p1} vs ${p2}${scoreStr}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function formatSide(id: string | null, getName: (id: string) => string): string {
  if (!id) return TBD;
  try {
    return getName(id);
  } catch {
    return BYE;
  }
}

function defaultRoundLabel(round: number, total: number): string {
  if (round === total) return 'Final';
  if (round === total - 1) return 'Semifinal';
  if (round === total - 2) return 'Cuartos';
  return `Round ${round}`;
}
