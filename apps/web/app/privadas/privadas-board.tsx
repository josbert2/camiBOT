'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Link01Icon, UserGroupIcon, Award01Icon } from '@hugeicons/core-free-icons';

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

const STATUS: Record<PrivadaStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Abierta', cls: 'border-success/40 bg-success/15 text-success' },
  CLOSED: { label: 'Cerrada', cls: 'border-warning/40 bg-warning/15 text-warning' },
  FINISHED: { label: 'Terminada', cls: 'border-border bg-muted text-muted-foreground' },
};

const SQUAD_LABEL: Record<number, string> = { 1: 'Solos', 2: 'Dúos', 3: 'Tríos', 4: 'Cuartetos' };

// Colores de equipo (categórico, estilo lobby de Warzone). Se ciclan por índice.
const TEAM_HUES = ['#b91c1c', '#1d4ed8', '#7c3aed', '#0e7490', '#c2410c', '#15803d', '#a21caf', '#a16207'];

export function PrivadasBoard({
  rows,
  isAdmin,
  isLoggedIn,
}: {
  rows: PrivadaRow[];
  isAdmin: boolean;
  isLoggedIn: boolean;
}) {
  return (
    <div className="space-y-6">
      {isAdmin && <PrivadaAdmin />}

      {rows.length === 0 ? (
        <p className="hud-panel p-6 text-center text-sm text-muted-foreground">
          No hay privadas todavía.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <PrivadaCard key={r.id} row={r} isAdmin={isAdmin} isLoggedIn={isLoggedIn} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PrivadaCard({
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
  const st = STATUS[row.status];

  const isTeams = row.squadSize > 1;
  const full = row.maxPlayers != null && row.totalSignups >= row.maxPlayers;
  const iAmCaptainSomewhere = row.squads.some((s) => s.iAmCaptain);
  const canAct = row.status === 'OPEN' && row.hasSignup;

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

  async function setStatus(status: PrivadaStatus) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/private-matches/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
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
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`hud-panel p-4 ${row.status === 'FINISHED' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display truncate text-2xl tracking-wide">{row.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            {row.scheduledAt && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                {row.scheduledAt}
              </span>
            )}
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={UserGroupIcon} className="h-3 w-3" />
              {row.totalSignups}
              {row.maxPlayers != null ? `/${row.maxPlayers}` : ''}
            </span>
            {isTeams && <span className="text-primary">{SQUAD_LABEL[row.squadSize] ?? `Equipos de ${row.squadSize}`}</span>}
            {row.prize && (
              <span className="flex items-center gap-1 text-accent">
                <HugeiconsIcon icon={Award01Icon} className="h-3 w-3" />
                {row.prize}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${st.cls}`}>
          {full && row.status === 'OPEN' ? 'Llena' : st.label}
        </span>
      </div>

      {row.link && (
        <a
          href={row.link}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 border-2 border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary transition hover:border-border-strong"
        >
          <HugeiconsIcon icon={Link01Icon} className="h-3.5 w-3.5" />
          Entrar a la sala
        </a>
      )}

      {row.hasSignup && isLoggedIn && canAct && (
        <div className="mt-3">
          <input
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="ID de juego (opcional)"
            className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong sm:max-w-xs"
          />
        </div>
      )}

      {row.hasSignup && !isTeams && (
        <SoloSignup
          row={row}
          isLoggedIn={isLoggedIn}
          busy={busy}
          full={full}
          onToggle={(joined) => call(joined ? 'DELETE' : 'POST', joined ? undefined : { gameId })}
        />
      )}

      {row.hasSignup && isTeams && (
        <TeamsSignup
          row={row}
          isLoggedIn={isLoggedIn}
          busy={busy}
          canAct={canAct}
          iAmCaptainSomewhere={iAmCaptainSomewhere}
          onCreate={(name) => call('POST', { squadName: name, gameId })}
          onJoin={(squadId) => call('POST', { squadId, gameId })}
          onLeave={() => call('DELETE')}
        />
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {isAdmin && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {row.status !== 'OPEN' && (
            <AdminBtn onClick={() => setStatus('OPEN')} busy={busy} tone="success">
              Reabrir
            </AdminBtn>
          )}
          {row.status === 'OPEN' && (
            <AdminBtn onClick={() => setStatus('CLOSED')} busy={busy} tone="warning">
              Cerrar inscripción
            </AdminBtn>
          )}
          {row.status !== 'FINISHED' && (
            <AdminBtn onClick={() => setStatus('FINISHED')} busy={busy}>
              Marcar terminada
            </AdminBtn>
          )}
          <AdminBtn onClick={remove} busy={busy} tone="danger">
            Borrar
          </AdminBtn>
        </div>
      )}
    </li>
  );
}

function SoloSignup({
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
    <>
      {row.signups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.signups.map((s) => (
            <Chip key={s.id} s={s} />
          ))}
        </div>
      )}

      {isLoggedIn ? (
        canJoin ? (
          <button
            onClick={() => onToggle(meIn)}
            disabled={busy}
            className={`mt-3 border-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50 ${
              meIn ? 'border-danger/50 text-danger hover:bg-danger hover:text-danger-foreground' : 'btn-tactical'
            }`}
          >
            {busy ? '…' : meIn ? 'Bajarme' : 'Me apunto'}
          </button>
        ) : (
          <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            {row.status !== 'OPEN' ? 'Inscripción cerrada' : full ? 'Cupo lleno' : ''}
          </p>
        )
      ) : (
        <LoginHint />
      )}
    </>
  );
}

function TeamsSignup({
  row,
  isLoggedIn,
  busy,
  canAct,
  iAmCaptainSomewhere,
  onCreate,
  onJoin,
  onLeave,
}: {
  row: PrivadaRow;
  isLoggedIn: boolean;
  busy: boolean;
  canAct: boolean;
  iAmCaptainSomewhere: boolean;
  onCreate: (name: string) => void;
  onJoin: (squadId: string) => void;
  onLeave: () => void;
}) {
  const [newName, setNewName] = useState('');
  const inASquad = row.mySquadId != null;

  return (
    <div className="mt-3 space-y-3">
      {row.teamless.length > 0 && (
        <div className="border-2 border-border bg-muted/30 p-2">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Sin asignar ({row.teamless.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {row.teamless.map((s) => (
              <Chip key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      {row.squads.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {row.squads.map((sq, i) => {
            const hue = TEAM_HUES[i % TEAM_HUES.length];
            const mine = sq.id === row.mySquadId;
            const canJoin = canAct && isLoggedIn && !mine && !sq.isFull && !iAmCaptainSomewhere;
            const members = [...sq.members].sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain));
            const slots = Array.from({ length: row.squadSize });
            return (
              <li
                key={sq.id}
                className={`flex flex-col overflow-hidden border-2 bg-card ${mine ? 'border-primary' : 'border-border'}`}
              >
                <div className="flex items-center gap-1.5 px-2 py-1" style={{ backgroundColor: hue }}>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/70">Team</span>
                  <span className="truncate text-xs font-bold text-white">{sq.name}</span>
                  <span className="ml-auto shrink-0 text-[9px] font-bold text-white/80">
                    {sq.size}/{row.squadSize}
                  </span>
                </div>
                <div className="flex-1 space-y-0.5 p-2">
                  {slots.map((_, idx) => {
                    const m = members[idx];
                    if (!m) {
                      return (
                        <div key={idx} className="truncate text-[11px] text-muted-foreground/25">
                          — libre —
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1 truncate text-[11px] ${m.isMe ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
                        title={m.gameId ? `${m.name} · ${m.gameId}` : m.name}
                      >
                        {m.isCaptain && <span className="shrink-0 text-[9px] font-bold uppercase text-accent">Cap.</span>}
                        <span className="truncate">{m.name}</span>
                      </div>
                    );
                  })}
                </div>
                {canJoin && (
                  <button
                    onClick={() => onJoin(sq.id)}
                    disabled={busy}
                    className="border-t-2 border-border bg-muted/40 py-1 text-[9px] font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? '…' : 'Unirme'}
                  </button>
                )}
                {sq.isFull && !mine && (
                  <div className="border-t-2 border-border py-1 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
                    Completo
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Todavía no hay equipos. Creá el primero.</p>
      )}

      {!isLoggedIn ? (
        <LoginHint />
      ) : !canAct ? (
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Inscripción cerrada</p>
      ) : inASquad ? (
        <button
          onClick={onLeave}
          disabled={busy}
          className="border-2 border-danger/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-danger transition hover:bg-danger hover:text-danger-foreground disabled:opacity-50"
        >
          {busy ? '…' : iAmCaptainSomewhere ? 'Disolver mi equipo / salir' : 'Salir del equipo'}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de tu equipo"
            className="flex-1 border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
          />
          <button
            onClick={() => {
              if (newName.trim()) onCreate(newName.trim());
              setNewName('');
            }}
            disabled={busy || !newName.trim()}
            className="btn-tactical text-xs disabled:opacity-50"
          >
            {busy ? '…' : 'Crear equipo (sos capitán)'}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ s, tag }: { s: PrivadaSignup; tag?: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 border px-1.5 py-0.5 text-[11px] ${
        s.isMe ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
      }`}
      title={s.gameId ? `${s.name} · ${s.gameId}` : s.name}
    >
      {s.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.avatarUrl} alt="" className="h-4 w-4 shrink-0 object-cover" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-muted text-[8px]">
          {s.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[10rem] truncate">{s.name}</span>
      {s.gameId && <span className="max-w-[7rem] truncate font-mono text-[9px] text-primary/80">{s.gameId}</span>}
      {tag && <span className="text-[8px] font-bold uppercase text-accent">{tag}</span>}
    </span>
  );
}

function LoginHint() {
  return (
    <a href="/login" className="mt-3 inline-block text-[10px] uppercase tracking-widest text-primary hover:underline">
      ▸ Iniciá sesión para apuntarte
    </a>
  );
}

function AdminBtn({
  children,
  onClick,
  busy,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone?: 'danger' | 'success' | 'warning';
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger/50 text-danger hover:bg-danger hover:text-danger-foreground'
      : tone === 'success'
        ? 'border-success/50 text-success hover:bg-success hover:text-success-foreground'
        : tone === 'warning'
          ? 'border-warning/50 text-warning hover:bg-warning hover:text-warning-foreground'
          : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground';
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
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
            <input
              type="number"
              min={2}
              max={200}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              placeholder="50"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fecha y hora
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hasSignup} onChange={(e) => setHasSignup(e.target.checked)} />
          Con inscripción (la gente se apunta). Si lo destildás es solo anuncio con link.
        </label>

        <button onClick={send} disabled={!canSend} className="btn-tactical text-xs disabled:opacity-50">
          {busy ? 'Creando…' : 'Crear privada'}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
