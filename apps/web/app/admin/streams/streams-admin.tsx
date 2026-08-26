'use client';

import { useMemo, useState } from 'react';
import { PlatformLogo, PLATFORM_META } from '../../envivo/platform-logo';

export type StreamUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
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
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar jugador…"
        className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.id} row={r} />
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados.</p>}
    </div>
  );
}

function Card({ row }: { row: StreamUser }) {
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

  return (
    <li className="overflow-hidden rounded-3xl border-2 border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-border object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
            {row.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{row.name}</div>
          {row.livePlatform ? (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> En vivo · {row.livePlatform}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Offline</span>
          )}
        </div>
      </div>

      {/* Inputs por plataforma */}
      <div className="space-y-2 p-4">
        <PlatformInput platform="twitch" value={twitch} onChange={setTwitch} placeholder="usuario de Twitch" />
        <PlatformInput platform="kick" value={kick} onChange={setKick} placeholder="slug de Kick" />
        <PlatformInput platform="tiktok" value={tiktok} onChange={setTiktok} placeholder="@usuario de TikTok" />

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={state === 'saving'}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {state === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
          {state === 'ok' && <span className="text-[10px] uppercase tracking-widest text-success">✓ guardado</span>}
          {state === 'err' && <span className="text-[10px] uppercase tracking-widest text-danger">error</span>}
        </div>
      </div>
    </li>
  );
}

function PlatformInput({
  platform,
  value,
  onChange,
  placeholder,
}: {
  platform: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <div className="flex items-center border-2 border-border bg-input focus-within:border-border-strong">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
        style={{ backgroundColor: meta?.color ?? '#333' }}
      >
        <PlatformLogo platform={platform} className="h-4 w-4" />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-3 py-1.5 text-sm outline-none"
      />
    </div>
  );
}
