import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { GameController01Icon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { discordAvatarUrl } from '@/lib/community';
import { PrivadasBoard, type PrivadaRow } from './privadas-board';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privadas — Tournify',
  description: 'Privadas de la comunidad: apuntate con tu Discord y jugá.',
};

export default async function PrivadasPage() {
  const session = await auth();
  const admin = isAdmin(session);
  const meId = session?.user?.id ?? null;

  const matches = await prisma.privateMatch.findMany({
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      signups: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { discordId: true, avatar: true, username: true, globalName: true, nickname: true } },
        },
      },
      squads: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, captainId: true },
      },
    },
  });

  const nameOf = (u: { nickname: string | null; globalName: string | null; username: string }) =>
    u.nickname ?? u.globalName ?? u.username;

  const rows: PrivadaRow[] = matches.map((m) => {
    const signups = m.signups.map((s) => ({
      id: s.id,
      userId: s.userId,
      squadId: s.squadId,
      gameId: s.gameId,
      name: nameOf(s.user),
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
  });

  const open = rows.filter((r) => r.status === 'OPEN').length;
  const totalPlayers = rows.reduce((n, r) => n + r.totalSignups, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <header className="mb-6 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={GameController01Icon} className="h-3.5 w-3.5" />
          <span>// PRIVADAS</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">Privadas</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Apuntate con tu Discord · el admin pasa el link de la sala
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <Stat label="Abiertas" value={open} tone="text-success" />
        <Stat label="Total" value={rows.length} tone="text-foreground" />
        <Stat label="Apuntados" value={totalPlayers} tone="text-primary" />
      </div>

      <PrivadasBoard rows={rows} isAdmin={admin} isLoggedIn={Boolean(meId)} />
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="hud-panel px-3 py-3 text-center">
      <div className={`display text-2xl ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
