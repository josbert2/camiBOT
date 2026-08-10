'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Reordena para que dos partidos seguidos no compartan jugador (intercalado). */
function interleave(ms: FixtureMatch[]): FixtureMatch[] {
  const pool = [...ms];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const out: FixtureMatch[] = [];
  let lastA: string | null = null;
  let lastB: string | null = null;
  while (pool.length) {
    let idx = pool.findIndex(
      (m) =>
        m.homeUserId !== lastA &&
        m.homeUserId !== lastB &&
        m.awayUserId !== lastA &&
        m.awayUserId !== lastB,
    );
    if (idx === -1) idx = 0;
    const m = pool.splice(idx, 1)[0]!;
    out.push(m);
    lastA = m.homeUserId;
    lastB = m.awayUserId;
  }
  return out;
}

export type FixtureMatch = {
  id: string;
  homeName: string;
  awayName: string;
  homeAvatar: string | null;
  awayAvatar: string | null;
  homeUserId: string;
  awayUserId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeKills: number | null;
  awayKills: number | null;
  status: string;
};

export function LeagueFixtures({
  leagueId,
  matches,
  isAdmin,
  myUserId,
}: {
  leagueId: string;
  matches: FixtureMatch[];
  isAdmin: boolean;
  myUserId: string | null;
}) {
  const [mode, setMode] = useState<'system' | 'mix'>('system');
  const [nonce, setNonce] = useState(0);
  const played = matches.filter((m) => m.status === 'PLAYED');
  const pending = useMemo(() => {
    const p = matches.filter((m) => m.status !== 'PLAYED');
    // nonce fuerza un re-mezclado cuando tocás "mezclar"
    void nonce;
    return mode === 'mix' ? interleave(p) : p;
  }, [matches, mode, nonce]);

  const tabClass = (active: boolean) =>
    `border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
      active ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Por jugar · {pending.length}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setMode('system')} className={tabClass(mode === 'system')}>
                Por sistema
              </button>
              <button onClick={() => setMode('mix')} className={tabClass(mode === 'mix')}>
                Intercalado
              </button>
              {mode === 'mix' && (
                <button
                  onClick={() => setNonce((n) => n + 1)}
                  className="border-2 border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
                  title="Volver a mezclar"
                >
                  ↻
                </button>
              )}
            </div>
          </div>
          <ul className="space-y-2">
            {pending.map((m) => (
              <MatchCard
                key={m.id}
                leagueId={leagueId}
                match={m}
                canEdit={isAdmin || myUserId === m.homeUserId || myUserId === m.awayUserId}
              />
            ))}
          </ul>
        </div>
      )}
      {played.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Jugados · {played.length}
          </div>
          <ul className="space-y-2">
            {played.map((m) => (
              <MatchCard
                key={m.id}
                leagueId={leagueId}
                match={m}
                canEdit={isAdmin || myUserId === m.homeUserId || myUserId === m.awayUserId}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 shrink-0 border border-border object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted text-[9px] text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function MatchCard({
  leagueId,
  match,
  canEdit,
}: {
  leagueId: string;
  match: FixtureMatch;
  canEdit: boolean;
}) {
  const router = useRouter();
  const played = match.status === 'PLAYED';
  const homeWon = played && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWon = played && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const [editing, setEditing] = useState(false);
  const [hs, setHs] = useState(match.homeScore?.toString() ?? '');
  const [as, setAs] = useState(match.awayScore?.toString() ?? '');
  const [hk, setHk] = useState(match.homeKills?.toString() ?? '');
  const [ak, setAk] = useState(match.awayKills?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/matches/${match.id}/result`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          homeScore: Number(hs),
          awayScore: Number(as),
          homeKills: hk === '' ? 0 : Number(hk),
          awayKills: ak === '' ? 0 : Number(ak),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo guardar.');
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`hud-panel p-3 ${played ? '' : 'opacity-95'}`}>
      <div className="flex items-center gap-2">
        {/* Local */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className={`min-w-0 truncate text-sm ${homeWon ? 'font-bold text-foreground' : ''}`}>
            {match.homeName}
          </span>
          <Avatar url={match.homeAvatar} name={match.homeName} />
        </div>

        {/* Marcador */}
        <div className="shrink-0 px-2 text-center">
          {played ? (
            <div className="display text-2xl leading-none tabular-nums">
              <span className={homeWon ? 'text-primary' : ''}>{match.homeScore}</span>
              <span className="text-muted-foreground"> - </span>
              <span className={awayWon ? 'text-primary' : ''}>{match.awayScore}</span>
            </div>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">vs</span>
          )}
        </div>

        {/* Visitante */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar url={match.awayAvatar} name={match.awayName} />
          <span className={`min-w-0 truncate text-sm ${awayWon ? 'font-bold text-foreground' : ''}`}>
            {match.awayName}
          </span>
        </div>
      </div>

      {played && (match.homeKills || match.awayKills) ? (
        <div className="mt-1 text-center text-[10px] uppercase tracking-widest text-danger">
          {match.homeKills ?? 0} kills · {match.awayKills ?? 0}
        </div>
      ) : null}

      {canEdit && !editing && (
        <div className="mt-2 text-center">
          <button
            onClick={() => setEditing(true)}
            className="border border-border px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
          >
            {played ? 'Editar resultado' : 'Cargar resultado'}
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="w-10 text-right text-[10px] uppercase text-muted-foreground">Goles</span>
            <input value={hs} onChange={(e) => setHs(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none" />
            <span>-</span>
            <input value={as} onChange={(e) => setAs(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none" />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="w-10 text-right text-[10px] uppercase text-muted-foreground">Kills</span>
            <input value={hk} onChange={(e) => setHk(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none" />
            <span>-</span>
            <input value={ak} onChange={(e) => setAk(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none" />
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={save} disabled={busy || hs === '' || as === ''} className="btn-tactical text-xs disabled:opacity-50">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-xs">
              Cancelar
            </button>
          </div>
          {error && <p className="text-center text-xs text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}
