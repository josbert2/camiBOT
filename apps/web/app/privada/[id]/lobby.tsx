'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Link01Icon, UserGroupIcon, Award01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { PrivadaRow, PrivadaSignup, PrivadaStatus } from '@/lib/privadas';

const STATUS: Record<PrivadaStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Abierta', cls: 'border-success/40 bg-success/15 text-success' },
  CLOSED: { label: 'Cerrada', cls: 'border-warning/40 bg-warning/15 text-warning' },
  FINISHED: { label: 'Terminada', cls: 'border-border bg-muted text-muted-foreground' },
};

const SQUAD_LABEL: Record<number, string> = { 1: 'Solos', 2: 'Dúos', 3: 'Tríos', 4: 'Cuartetos' };
const TEAM_HUES = ['#b91c1c', '#1d4ed8', '#7c3aed', '#0e7490', '#c2410c', '#15803d', '#a21caf', '#a16207'];

export function Lobby({
  row,
  isAdmin,
  isLoggedIn,
}: {
  row: PrivadaRow;
  isAdmin: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState(row.myGameId ?? '');
  const [newName, setNewName] = useState('');

  const st = STATUS[row.status];
  const isTeams = row.squadSize > 1;
  const full = row.maxPlayers != null && row.totalSignups >= row.maxPlayers;
  const iAmCaptainSomewhere = row.squads.some((s) => s.iAmCaptain);
  const canAct = row.status === 'OPEN' && row.hasSignup;
  const inASquad = row.mySquadId != null;

  async function call(method: 'POST' | 'DELETE', body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/private-matches/${row.id}/signup`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <Link href="/privadas" className="mb-4 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" /> Volver a privadas
      </Link>

      {/* Header */}
      <header className="hud-panel mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="stencil text-3xl md:text-4xl">{row.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
              {row.scheduledAt && (
                <span className="flex items-center gap-1"><HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5" />{row.scheduledAt}</span>
              )}
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={UserGroupIcon} className="h-3.5 w-3.5" />
                {row.totalSignups}{row.maxPlayers != null ? `/${row.maxPlayers}` : ''}
              </span>
              <span className="text-primary">{SQUAD_LABEL[row.squadSize] ?? `Equipos de ${row.squadSize}`}</span>
              {row.prize && (
                <span className="flex items-center gap-1 text-accent"><HugeiconsIcon icon={Award01Icon} className="h-3.5 w-3.5" />{row.prize}</span>
              )}
            </div>
          </div>
          <span className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>
            {full && row.status === 'OPEN' ? 'Llena' : st.label}
          </span>
        </div>

        {row.link && (
          <div className="mt-3">
            <a
              href={row.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 btn-ghost text-xs"
            >
              <HugeiconsIcon icon={Link01Icon} className="h-4 w-4" /> Abrir link de la sala
            </a>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Link externo del juego · abrilo cuando arranque
            </p>
          </div>
        )}

        {!row.hasSignup && (
          <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            Solo anuncio · sin inscripción{isAdmin ? ' — activala abajo' : ''}
          </p>
        )}
      </header>

      {/* ID de juego */}
      {row.hasSignup && isLoggedIn && canAct && (
        <div className="mb-4">
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">ID de juego (opcional)</label>
          <input
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Ej: Activision ID"
            className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong sm:max-w-sm"
          />
        </div>
      )}

      {!isLoggedIn && row.hasSignup && (
        <Link href="/login" className="mb-4 inline-block btn-tactical text-xs">Iniciá sesión para entrar</Link>
      )}

      {/* Cuerpo: solos o equipos */}
      {row.hasSignup && !isTeams && (
        <SoloRoster row={row} isLoggedIn={isLoggedIn} busy={busy} full={full} onToggle={(joined) => call(joined ? 'DELETE' : 'POST', joined ? undefined : { gameId })} />
      )}

      {row.hasSignup && isTeams && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* SIN ASIGNAR */}
          <aside className="hud-panel h-max p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Sin asignar ({row.teamless.length})
            </div>
            {row.teamless.length ? (
              <ul className="space-y-1">
                {row.teamless.map((s) => (
                  <li key={s.id}><RosterLine s={s} /></li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground/50">—</p>
            )}

            {isLoggedIn && canAct && (
              inASquad ? (
                <button
                  onClick={() => call('DELETE')}
                  disabled={busy}
                  className="mt-3 w-full border-2 border-danger/50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-danger transition hover:bg-danger hover:text-danger-foreground disabled:opacity-50"
                >
                  {busy ? '…' : iAmCaptainSomewhere ? 'Disolver / salir' : 'Salir del equipo'}
                </button>
              ) : (
                <div className="mt-3 space-y-1.5">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre de tu equipo"
                    className="w-full border-2 border-border bg-input px-2 py-1.5 text-xs outline-none focus:border-border-strong"
                  />
                  <button
                    onClick={() => { if (newName.trim()) call('POST', { squadName: newName.trim(), gameId }); setNewName(''); }}
                    disabled={busy || !newName.trim()}
                    className="w-full btn-tactical text-[10px] disabled:opacity-50"
                  >
                    {busy ? '…' : 'Crear equipo'}
                  </button>
                </div>
              )
            )}
          </aside>

          {/* GRID de equipos */}
          {row.squads.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {row.squads.map((sq, i) => {
                const hue = TEAM_HUES[i % TEAM_HUES.length];
                const mine = sq.id === row.mySquadId;
                const canJoin = canAct && isLoggedIn && !mine && !sq.isFull && !iAmCaptainSomewhere;
                const members = [...sq.members].sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain));
                const slots = Array.from({ length: row.squadSize });
                return (
                  <li key={sq.id} className={`flex flex-col overflow-hidden border-2 bg-card ${mine ? 'border-primary' : 'border-border'}`}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ backgroundColor: hue }}>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-white/70">Team</span>
                      <span className="truncate text-sm font-bold text-white">{sq.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] font-bold text-white/80">{sq.size}/{row.squadSize}</span>
                    </div>
                    <div className="flex-1 space-y-1 p-2">
                      {slots.map((_, idx) => {
                        const m = members[idx];
                        if (!m) return <div key={idx} className="text-[11px] text-muted-foreground/25">— libre —</div>;
                        return (
                          <div key={idx} className={`flex items-center gap-1.5 truncate text-[12px] ${m.isMe ? 'font-bold text-foreground' : 'text-muted-foreground'}`} title={m.gameId ? `${m.name} · ${m.gameId}` : m.name}>
                            {m.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.avatarUrl} alt="" className="h-5 w-5 shrink-0 border border-border object-cover" />
                            ) : (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-muted text-[8px]">
                                {m.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            {m.isCaptain && <span className="shrink-0 text-[9px] font-bold uppercase text-accent">Cap.</span>}
                            <span className="truncate">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    {canJoin && (
                      <button onClick={() => call('POST', { squadId: sq.id, gameId })} disabled={busy} className="border-t-2 border-border bg-muted/40 py-1.5 text-[9px] font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                        {busy ? '…' : 'Unirme'}
                      </button>
                    )}
                    {sq.isFull && !mine && (
                      <div className="border-t-2 border-border py-1.5 text-center text-[9px] uppercase tracking-widest text-muted-foreground">Completo</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="hud-panel flex items-center justify-center p-10 text-center text-sm text-muted-foreground">
              Todavía no hay equipos. {isLoggedIn && canAct ? 'Creá el primero desde el panel de la izquierda.' : ''}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      {/* Controles admin */}
      {isAdmin && <AdminControls row={row} />}
    </main>
  );
}

function SoloRoster({
  row,
  isLoggedIn,
  busy,
  full,
  onToggle,
}: {
  row: PrivadaRow;
  isLoggedIn: boolean;
  busy: boolean;
  full: boolean;
  onToggle: (joined: boolean) => void;
}) {
  const meIn = row.mySignedUp;
  const canJoin = row.status === 'OPEN' && (!full || meIn);
  return (
    <div className="hud-panel p-4">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Apuntados ({row.totalSignups}{row.maxPlayers != null ? `/${row.maxPlayers}` : ''})
      </div>
      {row.signups.length ? (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {row.signups.map((s) => (
            <li key={s.id}><RosterLine s={s} /></li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nadie apuntado todavía.</p>
      )}

      {isLoggedIn && (
        canJoin ? (
          <button
            onClick={() => onToggle(meIn)}
            disabled={busy}
            className={`mt-4 border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition disabled:opacity-50 ${
              meIn ? 'border-danger/50 text-danger hover:bg-danger hover:text-danger-foreground' : 'btn-tactical'
            }`}
          >
            {busy ? '…' : meIn ? 'Bajarme' : 'Me apunto'}
          </button>
        ) : (
          <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
            {row.status !== 'OPEN' ? 'Inscripción cerrada' : full ? 'Cupo lleno' : ''}
          </p>
        )
      )}
    </div>
  );
}

function RosterLine({ s }: { s: PrivadaSignup }) {
  return (
    <div
      className={`flex items-center gap-2 border px-2 py-1 text-[12px] ${s.isMe ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}
      title={s.gameId ? `${s.name} · ${s.gameId}` : s.name}
    >
      {s.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.avatarUrl} alt="" className="h-5 w-5 shrink-0 object-cover" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-muted text-[9px]">{s.name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="truncate">{s.name}</span>
      {s.gameId && <span className="ml-auto max-w-[7rem] truncate font-mono text-[9px] text-primary/80">{s.gameId}</span>}
    </div>
  );
}

function AdminControls({ row }: { row: PrivadaRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/private-matches/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !confirm(`¿Borrar la privada "${row.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/private-matches/${row.id}`, { method: 'DELETE' });
      if (res.ok) router.push('/privadas');
    } finally {
      setBusy(false);
    }
  }

  const btn = 'border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50';
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
      <span className="mr-1 self-center text-[10px] uppercase tracking-widest text-accent">Admin:</span>
      {row.hasSignup ? (
        <button onClick={() => patch({ hasSignup: false })} disabled={busy} className={`${btn} border-border text-muted-foreground hover:border-border-strong hover:text-foreground`}>Quitar inscripción</button>
      ) : (
        <button onClick={() => patch({ hasSignup: true })} disabled={busy} className={`${btn} border-success/50 text-success hover:bg-success hover:text-success-foreground`}>Activar inscripción</button>
      )}
      {row.status !== 'OPEN' && (
        <button onClick={() => patch({ status: 'OPEN' })} disabled={busy} className={`${btn} border-success/50 text-success hover:bg-success hover:text-success-foreground`}>Reabrir</button>
      )}
      {row.status === 'OPEN' && (
        <button onClick={() => patch({ status: 'CLOSED' })} disabled={busy} className={`${btn} border-warning/50 text-warning hover:bg-warning hover:text-warning-foreground`}>Cerrar inscripción</button>
      )}
      {row.status !== 'FINISHED' && (
        <button onClick={() => patch({ status: 'FINISHED' })} disabled={busy} className={`${btn} border-border text-muted-foreground hover:border-border-strong hover:text-foreground`}>Terminada</button>
      )}
      <button onClick={remove} disabled={busy} className={`${btn} border-danger/50 text-danger hover:bg-danger hover:text-danger-foreground`}>Borrar</button>
    </div>
  );
}
