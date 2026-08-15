import { prisma, Prisma } from '@camibot/db';
import { discordAvatarUrl } from './community';

export type PrivadaStatus = 'OPEN' | 'CLOSED' | 'FINISHED';

export type PrivadaSignup = {
  id: string;
  name: string;
  avatarUrl: string | null;
  gameId: string | null;
  isMe: boolean;
};

export type PrivadaMember = PrivadaSignup & { isCaptain: boolean };

export type PrivadaSquad = {
  id: string;
  name: string;
  members: PrivadaMember[];
  size: number;
  isFull: boolean;
  iAmCaptain: boolean;
};

export type PrivadaRow = {
  id: string;
  name: string;
  link: string | null;
  prize: string | null;
  hasSignup: boolean;
  squadSize: number;
  maxPlayers: number | null;
  status: PrivadaStatus;
  scheduledAt: string | null;
  totalSignups: number;
  mySignedUp: boolean;
  mySquadId: string | null;
  myGameId: string | null;
  signups: PrivadaSignup[];
  squads: PrivadaSquad[];
  teamless: PrivadaSignup[];
};

const privadaInclude = {
  signups: {
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { discordId: true, avatar: true, username: true, globalName: true, nickname: true } },
    },
  },
  squads: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, captainId: true } },
} satisfies Prisma.PrivateMatchInclude;

type PrivadaWith = Prisma.PrivateMatchGetPayload<{ include: typeof privadaInclude }>;

function mapRow(m: PrivadaWith, meId: string | null): PrivadaRow {
  const signups = m.signups.map((s) => ({
    id: s.id,
    userId: s.userId,
    squadId: s.squadId,
    gameId: s.gameId,
    name: s.user.nickname ?? s.user.globalName ?? s.user.username,
    avatarUrl: discordAvatarUrl(s.user.discordId, s.user.avatar),
    isMe: s.userId === meId,
  }));

  const mySignup = signups.find((s) => s.isMe) ?? null;

  const squads = m.squads.map((sq) => {
    const members = signups.filter((s) => s.squadId === sq.id);
    return {
      id: sq.id,
      name: sq.name,
      members: members.map((mm) => ({
        id: mm.id,
        name: mm.name,
        avatarUrl: mm.avatarUrl,
        gameId: mm.gameId,
        isMe: mm.isMe,
        isCaptain: mm.userId === sq.captainId,
      })),
      size: members.length,
      isFull: members.length >= m.squadSize,
      iAmCaptain: sq.captainId === meId,
    };
  });

  return {
    id: m.id,
    name: m.name,
    link: m.link,
    prize: m.prize,
    hasSignup: m.hasSignup,
    squadSize: m.squadSize,
    maxPlayers: m.maxPlayers,
    status: m.status,
    scheduledAt: m.scheduledAt
      ? m.scheduledAt.toLocaleString('es-CL', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    totalSignups: signups.length,
    mySignedUp: Boolean(mySignup),
    mySquadId: mySignup?.squadId ?? null,
    myGameId: mySignup?.gameId ?? null,
    signups: signups.map((s) => ({ id: s.id, name: s.name, avatarUrl: s.avatarUrl, gameId: s.gameId, isMe: s.isMe })),
    squads,
    teamless: signups
      .filter((s) => !s.squadId)
      .map((s) => ({ id: s.id, name: s.name, avatarUrl: s.avatarUrl, gameId: s.gameId, isMe: s.isMe })),
  };
}

/** Todas las privadas (para la lista /privadas). */
export async function fetchPrivadaRows(meId: string | null): Promise<PrivadaRow[]> {
  const matches = await prisma.privateMatch.findMany({
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: privadaInclude,
  });
  return matches.map((m) => mapRow(m, meId));
}

/**
 * Pre-crea los slots de equipo vacíos si es una privada por equipos y todavía
 * no tiene ninguno (así la gente se une "donde sea" sin crear equipos a mano).
 */
export async function ensureSquads(match: { id: string; squadSize: number; maxPlayers: number | null }): Promise<void> {
  if (match.squadSize <= 1) return;
  const existing = await prisma.privateSquad.count({ where: { matchId: match.id } });
  if (existing > 0) return;
  const base = match.maxPlayers ?? match.squadSize * 12;
  const n = Math.min(30, Math.max(2, Math.ceil(base / match.squadSize)));
  await prisma.privateSquad.createMany({
    data: Array.from({ length: n }, (_, i) => ({ matchId: match.id, name: `Equipo ${i + 1}` })),
  });
}

/** Una privada por id (para la lobby /privada/[id]). */
export async function fetchPrivadaRow(id: string, meId: string | null): Promise<PrivadaRow | null> {
  let m = await prisma.privateMatch.findUnique({ where: { id }, include: privadaInclude });
  if (!m) return null;
  if (m.squadSize > 1 && m.squads.length === 0) {
    await ensureSquads(m);
    m = await prisma.privateMatch.findUnique({ where: { id }, include: privadaInclude });
    if (!m) return null;
  }
  return mapRow(m, meId);
}
