'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Bloque de gestión de la liga, solo visible para admins. */
export function LeagueAdmin({ leagueId, status }: { leagueId: string; status: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const finished = status === 'FINISHED';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/liga/${leagueId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  async function setStatus(next: 'ACTIVE' | 'FINISHED') {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 border-2 border-accent/60 bg-card p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">[gestión · solo admin]</div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyLink}
          className="border-2 border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          {copied ? 'Copiado' : 'Copiar link'}
        </button>
        <button
          onClick={() => setStatus(finished ? 'ACTIVE' : 'FINISHED')}
          disabled={busy}
          className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition disabled:opacity-50 ${
            finished
              ? 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
              : 'border-danger text-danger hover:bg-danger hover:text-danger-foreground'
          }`}
        >
          {busy ? '…' : finished ? 'Reabrir liga' : 'Finalizar liga'}
        </button>
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        Los resultados los cargan admins o los propios jugadores en cada partido.
      </p>
    </section>
  );
}
