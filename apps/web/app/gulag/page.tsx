import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { ShieldUserIcon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { discordAvatarUrl } from '@/lib/community';
import { GulagBoard, type GulagRow } from './gulag-board';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gulag — Tournify',
  description: 'Acusados de usar hacks en la comunidad.',
};

export default async function GulagPage() {
  const session = await auth();
  const admin = isAdmin(session);

  const [entries, users] = await Promise.all([
    prisma.gulagEntry.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { user: { select: { discordId: true, avatar: true } } },
    }),
    // Para el selector de acusados del bloque admin.
    admin
      ? prisma.user.findMany({
          orderBy: { username: 'asc' },
          select: { id: true, username: true, globalName: true, nickname: true },
        })
      : Promise.resolve([]),
  ]);

  const rows: GulagRow[] = entries.map((e) => ({
    id: e.id,
    name: e.name,
    avatarUrl: e.user ? discordAvatarUrl(e.user.discordId, e.user.avatar) : null,
    reason: e.reason,
    evidence: e.evidence,
    status: e.status,
    date: e.createdAt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
  }));

  const count = (s: GulagRow['status']) => rows.filter((r) => r.status === s).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <header className="mb-8 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={ShieldUserIcon} className="h-3.5 w-3.5" />
          <span>// GULAG</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">GULAG</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Acusados de usar hacks. Acá se los deja anotados hasta que se demuestre lo contrario.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-2">
        <Stat label="Acusados" value={count('ACCUSED')} tone="text-warning" />
        <Stat label="Confirmados" value={count('CONFIRMED')} tone="text-danger" />
        <Stat label="Absueltos" value={count('ACQUITTED')} tone="text-success" />
      </section>

      <GulagBoard rows={rows} isAdmin={admin} users={users} />
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="hud-panel p-3 text-center">
      <div className={`display text-2xl leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
