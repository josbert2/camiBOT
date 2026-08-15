import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { GameController01Icon } from '@hugeicons/core-free-icons';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { fetchPrivadaRows } from '@/lib/privadas';
import { PrivadasBoard } from './privadas-board';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privadas — Tournify',
  description: 'Privadas de la comunidad: apuntate con tu Discord y jugá.',
};

export default async function PrivadasPage() {
  const session = await auth();
  const admin = isAdmin(session);
  const meId = session?.user?.id ?? null;

  const rows = await fetchPrivadaRows(meId);

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
          Entrá a una lobby, armá tu equipo y jugá
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <Stat label="Abiertas" value={open} tone="text-success" />
        <Stat label="Total" value={rows.length} tone="text-foreground" />
        <Stat label="Apuntados" value={totalPlayers} tone="text-primary" />
      </div>

      <PrivadasBoard rows={rows} isAdmin={admin} />
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
