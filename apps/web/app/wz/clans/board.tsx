'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

export type ClanRow = {
  id: string;
  name: string;
  slug: string;
  votes: number;
  createdAt: string;
};

type Props = {
  initialClans: ClanRow[];
  initialMyVoteId: string | null;
  initialVoteUnlockAt: string | null;
  initialRegisterUnlockAt: string | null;
};

function formatRemaining(unlockAt: string | null): string | null {
  if (!unlockAt) return null;
  const ms = new Date(unlockAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function ClansBoard({
  initialClans,
  initialMyVoteId,
  initialVoteUnlockAt,
  initialRegisterUnlockAt,
}: Props) {
  const [clans, setClans] = useState<ClanRow[]>(initialClans);
  const [myVoteId, setMyVoteId] = useState<string | null>(initialMyVoteId);
  const [voteUnlockAt, setVoteUnlockAt] = useState<string | null>(initialVoteUnlockAt);
  const [registerUnlockAt, setRegisterUnlockAt] = useState<string | null>(
    initialRegisterUnlockAt,
  );

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyVoteId, setBusyVoteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Forzar re-render cada 60s para que los contadores de cooldown bajen.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const registerRemaining = formatRemaining(registerUnlockAt);
  const voteRemaining = formatRemaining(voteUnlockAt);

  const sortedClans = useMemo(() => {
    return [...clans].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [clans]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = name.trim();
    if (!trimmed) return;

    const res = await fetch('/api/wz/clans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Error inesperado.');
      if (json.unlockAt) setRegisterUnlockAt(json.unlockAt as string);
      return;
    }

    startTransition(() => {
      setClans((prev) => [...prev, json.clan as ClanRow]);
      setName('');
      setRegisterUnlockAt(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
      setInfo(`Registraste "${(json.clan as ClanRow).name}". Ahora votalo si querés.`);
    });
  }

  async function handleVote(clanId: string) {
    setError(null);
    setInfo(null);
    setBusyVoteId(clanId);

    const res = await fetch('/api/wz/clans/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clanNameId: clanId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyVoteId(null);

    if (!res.ok) {
      setError(json.error ?? 'No se pudo registrar el voto.');
      if (json.unlockAt) setVoteUnlockAt(json.unlockAt as string);
      return;
    }

    if (json.unchanged) {
      setInfo('Ese ya era tu voto.');
      return;
    }

    startTransition(() => {
      setClans((prev) =>
        prev.map((c) => {
          if (c.id === clanId) return { ...c, votes: c.votes + 1 };
          if (c.id === myVoteId) return { ...c, votes: Math.max(0, c.votes - 1) };
          return c;
        }),
      );
      setMyVoteId(clanId);
      setVoteUnlockAt(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
      setInfo(json.changed ? 'Voto cambiado.' : 'Voto registrado.');
    });
  }

  return (
    <div className="space-y-6">
      <section className="hud-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-lg uppercase">Registrar nombre</h2>
          {registerRemaining && (
            <span className="tag-tactical">Próximo registro: {registerRemaining}</span>
          )}
        </div>
        <form onSubmit={handleRegister} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Ej: NIGHT REAPERS"
            disabled={Boolean(registerRemaining)}
            className={cn(
              'flex-1 border-2 border-border bg-input px-4 py-2 text-base uppercase tracking-wider',
              'focus:border-border-strong focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <button
            type="submit"
            disabled={Boolean(registerRemaining) || !name.trim()}
            className="btn-tactical disabled:cursor-not-allowed disabled:opacity-50"
          >
            Registrar
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          3–24 caracteres. 1 nombre cada 24h por IP. Sin palabrotas.
        </p>
      </section>

      {(error || info) && (
        <div
          className={cn(
            'border-2 px-4 py-3 text-sm',
            error ? 'border-danger/60 bg-danger/10 text-danger' : 'border-primary/60 bg-primary/10 text-primary',
          )}
        >
          {error ?? info}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="display text-lg uppercase">Ranking</h2>
          {voteRemaining ? (
            <span className="tag-tactical">Cambiar voto en: {voteRemaining}</span>
          ) : myVoteId ? (
            <span className="tag-tactical text-primary">Podés cambiar tu voto</span>
          ) : (
            <span className="tag-tactical">Aún no votaste</span>
          )}
        </div>

        {sortedClans.length === 0 ? (
          <div className="hud-panel p-8 text-center text-muted-foreground">
            Sin propuestas todavía. Registrá la primera.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedClans.map((c, idx) => {
              const isMine = c.id === myVoteId;
              const cooldownActive = Boolean(voteRemaining) && !isMine;
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-4 border-2 px-4 py-3',
                    isMine ? 'border-primary bg-primary/10' : 'border-border bg-card',
                  )}
                >
                  <span className="display w-10 text-2xl text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="display text-lg uppercase truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.votes} {c.votes === 1 ? 'voto' : 'votos'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVote(c.id)}
                    disabled={cooldownActive || busyVoteId === c.id || isMine}
                    className={cn(
                      isMine ? 'btn-ghost' : 'btn-tactical',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {isMine ? 'Tu voto' : busyVoteId === c.id ? '...' : 'Votar'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
