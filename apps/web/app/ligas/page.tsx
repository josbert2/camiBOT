import type { Metadata } from 'next';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ligas — Tournify',
  description: 'Ligas round-robin: tabla de posiciones y resultados.',
};

export default async function LigasPage() {
  const leagues = await prisma.league.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { _count: { select: { players: true, matches: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={ChampionIcon} className="h-3.5 w-3.5" />
          <span>// LIGAS</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">Ligas</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Todos contra todos · puntos 3/1/0 · con kills
        </p>
      </header>

      {leagues.length === 0 ? (
        <div className="hud-panel px-6 py-16 text-center">
          <p className="display text-2xl tracking-widest text-muted-foreground">No hay ligas todavía</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leagues.map((l) => (
            <Link
              key={l.id}
              href={`/liga/${l.id}`}
              className={`hud-panel block p-5 transition hover:border-border-strong ${
                l.status === 'ACTIVE' ? '!border-primary' : ''
              }`}
            >
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                {l.status === 'ACTIVE' ? 'En curso' : 'Finalizada'}
              </div>
              <h2 className="display truncate text-2xl tracking-wide">{l.name}</h2>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                {l._count.players} jugadores · {l._count.matches} partidos
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
