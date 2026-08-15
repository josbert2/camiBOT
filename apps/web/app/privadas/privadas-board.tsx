'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, UserGroupIcon, Award01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { PrivadaRow, PrivadaStatus } from '@/lib/privadas';

const STATUS: Record<PrivadaStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Abierta', cls: 'border-success/40 bg-success/15 text-success' },
  CLOSED: { label: 'Cerrada', cls: 'border-warning/40 bg-warning/15 text-warning' },
  FINISHED: { label: 'Terminada', cls: 'border-border bg-muted text-muted-foreground' },
};

const SQUAD_LABEL: Record<number, string> = { 1: 'Solos', 2: 'Dúos', 3: 'Tríos', 4: 'Cuartetos' };

export function PrivadasBoard({ rows, isAdmin }: { rows: PrivadaRow[]; isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      {isAdmin && <PrivadaAdmin />}

      {rows.length === 0 ? (
        <p className="hud-panel p-6 text-center text-sm text-muted-foreground">No hay privadas todavía.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/privada/${r.id}` as Route}
                className={`hud-panel block p-4 transition hover:border-border-strong ${r.status === 'OPEN' ? '!border-primary/60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="display truncate text-2xl tracking-wide">{r.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {r.scheduledAt && (
                        <span className="flex items-center gap-1"><HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />{r.scheduledAt}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={UserGroupIcon} className="h-3 w-3" />
                        {r.totalSignups}{r.maxPlayers != null ? `/${r.maxPlayers}` : ''}
                      </span>
                      <span className="text-primary">{SQUAD_LABEL[r.squadSize] ?? `Equipos de ${r.squadSize}`}</span>
                      {r.prize && (
                        <span className="flex items-center gap-1 text-accent"><HugeiconsIcon icon={Award01Icon} className="h-3 w-3" />{r.prize}</span>
                      )}
                      {!r.hasSignup && <span>Solo anuncio</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${STATUS[r.status].cls}`}>
                    {STATUS[r.status].label}
                  </span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Entrar a la lobby <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Form para armar una privada, solo visible para admins. */
function PrivadaAdmin() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [prize, setPrize] = useState('');
  const [hasSignup, setHasSignup] = useState(true);
  const [squadSize, setSquadSize] = useState('1');
  const [maxPlayers, setMaxPlayers] = useState('50');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = name.trim().length > 0 && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/private-matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          link,
          prize,
          hasSignup,
          squadSize: Number(squadSize),
          maxPlayers: maxPlayers ? Number(maxPlayers) : null,
          scheduledAt: scheduledAt || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo crear.');
      setName('');
      setLink('');
      setPrize('');
      setHasSignup(true);
      setSquadSize('1');
      setMaxPlayers('50');
      setScheduledAt('');
      router.refresh();
      if (json?.id) router.push(`/privada/${json.id}` as Route);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong';

  return (
    <section className="border-2 border-accent/60 bg-card p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">[armar privada · solo admin]</div>

      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la privada" className={field} />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link de la sala / invite de Discord" className={field} />
        <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Premio (opcional)" className={field} />

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Squad
            <select value={squadSize} onChange={(e) => setSquadSize(e.target.value)} className={field}>
              <option value="1">Solos</option>
              <option value="2">Dúos</option>
              <option value="3">Tríos</option>
              <option value="4">Cuartetos</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Cupo
            <input type="number" min={2} max={200} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="50" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fecha y hora
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={field} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hasSignup} onChange={(e) => setHasSignup(e.target.checked)} />
          Con inscripción (la gente se apunta). Destildá solo si querés un anuncio con link, sin lobby.
        </label>

        <button onClick={send} disabled={!canSend} className="btn-tactical text-xs disabled:opacity-50">
          {busy ? 'Creando…' : 'Crear privada'}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
