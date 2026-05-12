// Cálculos derivados de los matches de un user. On-the-fly, no se persisten.

interface MatchRow {
  completedAt: Date | null;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
}

interface ParticipantInfo {
  participantId: string;
  userId: string;
}

interface MatchWithParticipants extends MatchRow {
  participant1?: ParticipantInfo | null;
  participant2?: ParticipantInfo | null;
}

/**
 * Calcula la racha actual (wins consecutivos sin perder) y el récord histórico.
 * Los matches deben venir COMPLETED y ordenados por completedAt desc.
 */
export function computeStreaks(
  myParticipantIds: string[],
  matches: MatchRow[],
): { current: number; best: number } {
  const mine = new Set(myParticipantIds);
  // Ordenar por completedAt desc para "current"
  const desc = [...matches]
    .filter((m) => m.completedAt && m.winnerId)
    .sort((a, b) => (b.completedAt!.getTime() - a.completedAt!.getTime()));

  let current = 0;
  for (const m of desc) {
    const won = mine.has(m.winnerId!);
    if (won) current++;
    else break;
  }

  // Best: recorremos asc y trackeamos el max
  const asc = [...desc].reverse();
  let best = 0;
  let run = 0;
  for (const m of asc) {
    if (mine.has(m.winnerId!)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

export interface H2HRecord {
  opponentUserId: string;
  opponentName: string;
  wins: number;
  losses: number;
}

/**
 * Para cada oponente que enfrentó, cuántos matches ganó/perdió.
 */
export function computeHeadToHead(
  myUserId: string,
  matches: (MatchWithParticipants & { _opponentName?: Map<string, string> })[],
  nameByUserId: Map<string, string>,
): H2HRecord[] {
  const records = new Map<string, H2HRecord>();

  for (const m of matches) {
    if (!m.completedAt || !m.winnerId) continue;
    const p1u = m.participant1?.userId;
    const p2u = m.participant2?.userId;
    if (!p1u || !p2u) continue;
    if (p1u !== myUserId && p2u !== myUserId) continue;

    const oppUserId = p1u === myUserId ? p2u : p1u;
    const wonByMe =
      (m.participant1?.userId === myUserId && m.winnerId === m.participant1.participantId) ||
      (m.participant2?.userId === myUserId && m.winnerId === m.participant2.participantId);

    let rec = records.get(oppUserId);
    if (!rec) {
      rec = {
        opponentUserId: oppUserId,
        opponentName: nameByUserId.get(oppUserId) ?? 'Desconocido',
        wins: 0,
        losses: 0,
      };
      records.set(oppUserId, rec);
    }
    if (wonByMe) rec.wins++;
    else rec.losses++;
  }

  return [...records.values()].sort((a, b) => {
    const totalA = a.wins + a.losses;
    const totalB = b.wins + b.losses;
    if (totalB !== totalA) return totalB - totalA;
    return b.wins - a.wins;
  });
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export interface AchievementInput {
  tournamentsPlayed: number;
  tournamentsWon: number;
  totalWins: number;
  totalLosses: number;
  bestStreak: number;
  participationsWithStatus: { status: string; finalRank: number | null; seed: number | null }[];
  // Para "Underdog": ganó torneo siendo seed > maxParticipants/2
  // Para "Perfect Run": ganó torneo sin perder ningún match
  perfectRuns: number;
  underdogRuns: number;
  comebackWins: number; // ganó desde losers bracket
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'progress'>[] = [
  {
    id: 'first-blood',
    name: 'Primer torneo',
    description: 'Participá en tu primer torneo',
    emoji: '🥁',
  },
  {
    id: 'first-win',
    name: 'Estreno',
    description: 'Gana tu primer match',
    emoji: '✊',
  },
  {
    id: 'champion',
    name: 'Campeón',
    description: 'Gana un torneo',
    emoji: '🏆',
  },
  {
    id: 'champion-x3',
    name: 'Triple corona',
    description: 'Gana 3 torneos',
    emoji: '👑',
  },
  {
    id: 'champion-x10',
    name: 'Leyenda',
    description: 'Gana 10 torneos',
    emoji: '🌟',
  },
  {
    id: 'veteran',
    name: 'Veterano',
    description: 'Jugá 10 torneos',
    emoji: '🎖️',
  },
  {
    id: 'master',
    name: 'Maestro',
    description: 'Jugá 50 torneos',
    emoji: '🧙',
  },
  {
    id: 'streak-5',
    name: 'En llamas',
    description: 'Gana 5 matches seguidos',
    emoji: '🔥',
  },
  {
    id: 'streak-10',
    name: 'Imparable',
    description: 'Gana 10 matches seguidos',
    emoji: '⚡',
  },
  {
    id: 'streak-20',
    name: 'Dios del bracket',
    description: 'Gana 20 matches seguidos',
    emoji: '💫',
  },
  {
    id: 'underdog',
    name: 'Underdog',
    description: 'Gana un torneo siendo seed bajo (segunda mitad)',
    emoji: '🐺',
  },
  {
    id: 'perfect-run',
    name: 'Perfect run',
    description: 'Gana un torneo sin perder ningún match',
    emoji: '💎',
  },
  {
    id: 'comeback-kid',
    name: 'Comeback kid',
    description: 'Gana un torneo desde el losers bracket',
    emoji: '🔄',
  },
];

export function computeAchievements(input: AchievementInput): Achievement[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    let unlocked = false;
    let progress: { current: number; target: number } | undefined;
    switch (def.id) {
      case 'first-blood':
        unlocked = input.tournamentsPlayed >= 1;
        break;
      case 'first-win':
        unlocked = input.totalWins >= 1;
        break;
      case 'champion':
        unlocked = input.tournamentsWon >= 1;
        progress = { current: input.tournamentsWon, target: 1 };
        break;
      case 'champion-x3':
        unlocked = input.tournamentsWon >= 3;
        progress = { current: input.tournamentsWon, target: 3 };
        break;
      case 'champion-x10':
        unlocked = input.tournamentsWon >= 10;
        progress = { current: input.tournamentsWon, target: 10 };
        break;
      case 'veteran':
        unlocked = input.tournamentsPlayed >= 10;
        progress = { current: input.tournamentsPlayed, target: 10 };
        break;
      case 'master':
        unlocked = input.tournamentsPlayed >= 50;
        progress = { current: input.tournamentsPlayed, target: 50 };
        break;
      case 'streak-5':
        unlocked = input.bestStreak >= 5;
        progress = { current: input.bestStreak, target: 5 };
        break;
      case 'streak-10':
        unlocked = input.bestStreak >= 10;
        progress = { current: input.bestStreak, target: 10 };
        break;
      case 'streak-20':
        unlocked = input.bestStreak >= 20;
        progress = { current: input.bestStreak, target: 20 };
        break;
      case 'underdog':
        unlocked = input.underdogRuns >= 1;
        break;
      case 'perfect-run':
        unlocked = input.perfectRuns >= 1;
        break;
      case 'comeback-kid':
        unlocked = input.comebackWins >= 1;
        break;
    }
    return { ...def, unlocked, progress };
  });
}
