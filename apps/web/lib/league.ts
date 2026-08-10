import { prisma } from '@camibot/db';
import { discordAvatarUrl } from '@/lib/community';

/** Diferencia de kills a partir de la cual el multiplicador de victoria es x1.4. */
const KILL_DIFF_HIGH = 5;

/** Todas las parejas round-robin (cada par una vez). */
export function roundRobinPairs(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i]!, ids[j]!]);
    }
  }
  return pairs;
}

type RawPlayer = {
  id: string;
  user: {
    discordId: string;
    username: string;
    globalName: string | null;
    nickname: string | null;
    avatar: string | null;
  };
};

type RawMatch = {
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeKills: number | null;
  awayKills: number | null;
  status: string;
};

export type StandingRow = {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
  kills: number;
};

/** Tabla de posiciones: puntos 3/1/0, orden Pts → DG → GF → Kills. */
export function computeStandings(players: RawPlayer[], matches: RawMatch[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const p of players) {
    map.set(p.id, {
      playerId: p.id,
      name: p.user.nickname ?? p.user.globalName ?? p.user.username,
      avatarUrl: discordAvatarUrl(p.user.discordId, p.user.avatar),
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0,
      kills: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'PLAYED' || m.homeScore == null || m.awayScore == null) continue;
    const h = map.get(m.homeId);
    const a = map.get(m.awayId);
    if (!h || !a) continue;
    const hk = m.homeKills ?? 0;
    const ak = m.awayKills ?? 0;

    h.pj++;
    a.pj++;
    h.gf += m.homeScore;
    h.gc += m.awayScore;
    a.gf += m.awayScore;
    a.gc += m.homeScore;
    h.kills += hk;
    a.kills += ak;

    const homeWon = m.homeScore > m.awayScore;
    const awayWon = m.awayScore > m.homeScore;
    if (homeWon) {
      h.pg++;
      a.pp++;
    } else if (awayWon) {
      a.pg++;
      h.pp++;
    } else {
      h.pe++;
      a.pe++;
    }

    // Puntos = kills; si ganás, tus kills se multiplican según la diferencia
    // de kills del partido (grande → x1.4, ajustada → x1.2).
    const mult = Math.abs(hk - ak) >= KILL_DIFF_HIGH ? 1.4 : 1.2;
    h.pts += hk * (homeWon ? mult : 1);
    a.pts += ak * (awayWon ? mult : 1);
  }

  const rows = [...map.values()];
  for (const r of rows) {
    r.dg = r.gf - r.gc;
    r.pts = Math.round(r.pts * 10) / 10;
  }
  rows.sort((x, y) => y.pts - x.pts || y.kills - x.kills || y.pg - x.pg);
  return rows;
}

const playerInclude = {
  user: {
    select: {
      id: true,
      discordId: true,
      username: true,
      globalName: true,
      nickname: true,
      avatar: true,
    },
  },
} as const;

/** Liga por id o slug, con jugadores y partidos. */
export function getLeague(slugOrId: string) {
  return prisma.league.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    include: {
      players: { include: playerInclude },
      matches: {
        orderBy: { createdAt: 'asc' },
        include: { home: { include: playerInclude }, away: { include: playerInclude } },
      },
    },
  });
}
