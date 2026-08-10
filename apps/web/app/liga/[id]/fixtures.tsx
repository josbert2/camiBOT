'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type FixtureMatch = {
  id: string;
  homeName: string;
  awayName: string;
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
  return (
    <ul className="space-y-2">
      {matches.map((m) => (
        <MatchRow
          key={m.id}
          leagueId={leagueId}
          match={m}
          canEdit={isAdmin || myUserId === m.homeUserId || myUserId === m.awayUserId}
        />
      ))}
    </ul>
  );
}

function MatchRow({
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
    <li className="border-2 border-border bg-card px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-right text-sm">{match.homeName}</span>
        <span className="shrink-0 text-center font-mono text-sm">
          {played ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{match.awayName}</span>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
          >
            {played ? 'Editar' : 'Cargar'}
          </button>
        )}
      </div>

      {played && !editing && (match.homeKills || match.awayKills) ? (
        <div className="mt-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          kills {match.homeKills ?? 0} - {match.awayKills ?? 0}
        </div>
      ) : null}

      {editing && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-[10px] uppercase text-muted-foreground">Goles</span>
            <input
              value={hs}
              onChange={(e) => setHs(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none"
            />
            <span>-</span>
            <input
              value={as}
              onChange={(e) => setAs(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none"
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-[10px] uppercase text-muted-foreground">Kills</span>
            <input
              value={hk}
              onChange={(e) => setHk(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none"
            />
            <span>-</span>
            <input
              value={ak}
              onChange={(e) => setAk(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className="w-12 border-2 border-border bg-input px-2 py-1 text-center text-sm outline-none"
            />
          </div>
          <div className="flex justify-center gap-2">
            <button
              onClick={save}
              disabled={busy || hs === '' || as === ''}
              className="btn-tactical text-xs disabled:opacity-50"
            >
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
