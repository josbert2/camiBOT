'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type GulagStatus = 'ACCUSED' | 'CONFIRMED' | 'ACQUITTED';

export type GulagRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  reason: string | null;
  evidence: string | null;
  status: GulagStatus;
  date: string;
};

type UserOption = {
  id: string;
  username: string;
  globalName: string | null;
  nickname: string | null;
};

const STATUS: Record<GulagStatus, { label: string; cls: string }> = {
  ACCUSED: { label: 'Acusado', cls: 'border-warning/40 bg-warning/15 text-warning' },
  CONFIRMED: { label: 'Confirmado', cls: 'border-danger/40 bg-danger/15 text-danger' },
  ACQUITTED: { label: 'Absuelto', cls: 'border-success/40 bg-success/15 text-success' },
};

export function GulagBoard({
  rows,
  isAdmin,
  users,
}: {
  rows: GulagRow[];
  isAdmin: boolean;
  users: UserOption[];
}) {
  return (
    <div className="space-y-6">
      {isAdmin && <GulagAdmin users={users} />}

      {rows.length === 0 ? (
        <p className="hud-panel p-6 text-center text-sm text-muted-foreground">
          El gulag está vacío. Por ahora.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <GulagCard key={r.id} row={r} isAdmin={isAdmin} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GulagCard({ row, isAdmin }: { row: GulagRow; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const st = STATUS[row.status];

  async function setStatus(status: GulagStatus) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gulag/${row.id}`, {
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
    if (busy || !confirm(`¿Sacar a ${row.name} del gulag?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gulag/${row.id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`hud-panel p-3 ${row.status === 'ACQUITTED' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.avatarUrl} alt="" className="h-10 w-10 shrink-0 border border-border object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-muted text-[10px] text-muted-foreground">
            {row.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-bold">{row.name}</span>
            <span className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${st.cls}`}>
              {st.label}
            </span>
          </div>
          {row.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.reason}</p>}
          {row.evidence && (
            <a
              href={row.evidence}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              ▸ ver prueba
            </a>
          )}
        </div>

        <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
          {row.date}
        </span>
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2">
          {row.status !== 'CONFIRMED' && (
            <AdminBtn onClick={() => setStatus('CONFIRMED')} busy={busy} tone="danger">
              Confirmar hack
            </AdminBtn>
          )}
          {row.status !== 'ACQUITTED' && (
            <AdminBtn onClick={() => setStatus('ACQUITTED')} busy={busy} tone="success">
              Absolver
            </AdminBtn>
          )}
          {row.status !== 'ACCUSED' && (
            <AdminBtn onClick={() => setStatus('ACCUSED')} busy={busy}>
              Volver a acusado
            </AdminBtn>
          )}
          <AdminBtn onClick={remove} busy={busy}>
            Sacar
          </AdminBtn>
        </div>
      )}
    </li>
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
  tone?: 'danger' | 'success';
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger/50 text-danger hover:bg-danger hover:text-danger-foreground'
      : tone === 'success'
        ? 'border-success/50 text-success hover:bg-success hover:text-success-foreground'
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

/** Bloque para mandar gente al gulag, solo visible para admins. */
function GulagAdmin({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (u: UserOption) => u.nickname ?? u.globalName ?? u.username;
  const canSend = Boolean(userId || name.trim()) && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/gulag', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userId || null, name, reason, evidence }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo guardar.');
      setUserId('');
      setName('');
      setReason('');
      setEvidence('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong';

  return (
    <section className="border-2 border-accent/60 bg-card p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">[comandos · solo admin]</div>

      <div className="space-y-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
          <option value="">— Acusado sin cuenta (escribir nombre) —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {nameOf(u)}
            </option>
          ))}
        </select>

        {!userId && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del acusado"
            className={field}
          />
        )}

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="De qué se lo acusa (aimbot, wallhack...)"
          className={field}
        />
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Link a la prueba (opcional)"
          className={field}
        />

        <button onClick={send} disabled={!canSend} className="btn-tactical text-xs disabled:opacity-50">
          {busy ? 'Mandando…' : 'Mandar al gulag'}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
