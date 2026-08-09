import type { Metadata } from 'next';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Torneos — Tournify',
  description: 'Torneos con registro abierto. Sumate desde la web.',
};

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION: 'Registro abierto',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const STATUS_ORDER: Record<string, number> = {
  REGISTRATION: 0,
  CHECK_IN: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
  CANCELLED: 4,
};

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Eliminación simple',
  DOUBLE_ELIMINATION: 'Doble eliminación',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Sistema suizo',
  FFA: 'FFA / Carrera',
  GROUP_STAGE: 'Fase de grupos',
};

export default async function TorneosPage() {
  const tournaments = await prisma.tournament.findMany({
    where: { visibility: 'PUBLIC', status: { not: 'DRAFT' } },
    include: {
      _count: { select: { participants: true } },
      guild: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const sorted = [...tournaments].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={ChampionIcon} className="h-3.5 w-3.5" />
          <span>// TORNEOS</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">Torneos</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Registro abierto · sumate desde acá
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="hud-panel px-6 py-16 text-center">
          <p className="display text-2xl tracking-widest text-muted-foreground">
            No hay torneos públicos
          </p>
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
            Cuando se abra uno, aparece acá
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((t) => {
            const open = t.status === 'REGISTRATION';
            return (
              <Link
                key={t.id}
                href={`/t/${t.id}`}
                className={`hud-panel block p-5 transition hover:border-border-strong ${
                  open ? '!border-primary' : ''
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      open ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.guild.name}
                  </span>
                </div>
                <h2 className="display truncate text-2xl tracking-wide">{t.name}</h2>
                <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{FORMAT_LABELS[t.format] ?? t.format}</span>
                  <span className="tabular-nums text-foreground">
                    {t._count.participants} / {t.maxParticipants}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
