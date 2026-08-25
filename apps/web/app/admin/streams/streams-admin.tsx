'use client';

import { useMemo, useState } from 'react';

export type StreamUser = {
  id: string;
  name: string;
  twitchLogin: string | null;
  kickSlug: string | null;
  tiktokUser: string | null;
  livePlatform: string | null;
};

export function StreamsAdmin({ rows }: { rows: StreamUser[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar jugador…"
        className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
      />
      <ul className="space-y-2">
        {filtered.map((r) => (
          <Row key={r.id} row={r} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados.</p>}
      </ul>
    </div>
  );
}

function Row({ row }: { row: StreamUser }) {
  const [twitch, setTwitch] = useState(row.twitchLogin ?? '');
  const [kick, setKick] = useState(row.kickSlug ?? '');
  const [tiktok, setTiktok] = useState(row.tiktokUser ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');

  async function save() {
    setState('saving');
    try {
      const res = await fetch('/api/admin/streams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: row.id, twitchLogin: twitch, kickSlug: kick, tiktokUser: tiktok }),
      });
      setState(res.ok ? 'ok' : 'err');
    } catch {
      setState('err');
    }
  }

  const field = 'w-full border-2 border-border bg-input px-2 py-1.5 text-sm outline-none focus:border-border-strong';

  return (
    <li className="hud-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-bold">{row.name}</span>
        {row.livePlatform && (
          <span className="border border-danger/50 bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-danger">
            EN VIVO · {row.livePlatform}
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={twitch} onChange={(e) => setTwitch(e.target.value)} placeholder="Twitch user" className={field} />
        <input value={kick} onChange={(e) => setKick(e.target.value)} placeholder="Kick slug" className={field} />
        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="TikTok @user" className={field} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={state === 'saving'} className="btn-tactical text-xs disabled:opacity-50">
          {state === 'saving' ? 'Guardando…' : 'Guardar'}
        </button>
        {state === 'ok' && <span className="text-[10px] uppercase tracking-widest text-success">✓ guardado</span>}
        {state === 'err' && <span className="text-[10px] uppercase tracking-widest text-danger">error</span>}
      </div>
    </li>
  );
}
