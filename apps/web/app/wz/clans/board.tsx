'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { CneBanner } from './cne-banner';

export type ClanRow = {
  id: string;
  name: string;
  slug: string;
  votes: number;
  createdAt: string;
};

type Props = {
  initialClans: ClanRow[];
  initialMyVoteIds: string[];
  initialRegisterUnlockAt: string | null;
};

const MAX_VOTES = 5;

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
  initialMyVoteIds,
  initialRegisterUnlockAt,
}: Props) {
  const [clans, setClans] = useState<ClanRow[]>(initialClans);
  const [myVoteIds, setMyVoteIds] = useState<Set<string>>(new Set(initialMyVoteIds));
  const [registerUnlockAt, setRegisterUnlockAt] = useState<string | null>(
    initialRegisterUnlockAt,
  );

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyVoteId, setBusyVoteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const registerRemaining = formatRemaining(registerUnlockAt);
  const votesLeft = MAX_VOTES - myVoteIds.size;

  const sortedClans = useMemo(() => {
    return [...clans].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [clans]);

  async function registerClan(rawName: string): Promise<ClanRow | null> {
    setError(null);
    setInfo(null);
    const trimmed = rawName.trim();
    if (!trimmed) return null;

    const res = await fetch('/api/wz/clans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Error inesperado.');
      if (json.unlockAt) setRegisterUnlockAt(json.unlockAt as string);
      return null;
    }

    const clan = json.clan as ClanRow;
    startTransition(() => {
      setClans((prev) => [...prev, clan]);
      setRegisterUnlockAt(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
    });
    return clan;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const clan = await registerClan(name);
    if (clan) {
      setName('');
      setInfo(`Registraste "${clan.name}". Ya podés votarlo.`);
    }
  }

  async function handleCreateClanFromBanner(rawName: string) {
    const clan = await registerClan(rawName);
    if (clan) {
      setInfo(`Postulaste "${clan.name}". Votando automáticamente…`);
      await handleToggleVote(clan.id);
    }
  }

  async function handleToggleVote(clanId: string) {
    setError(null);
    setInfo(null);
    setBusyVoteId(clanId);

    const isVoted = myVoteIds.has(clanId);
    const action = isVoted ? 'remove' : 'add';

    const res = await fetch('/api/wz/clans/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clanNameId: clanId, action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyVoteId(null);

    if (!res.ok) {
      setError(json.error ?? 'No se pudo registrar el voto.');
      if (Array.isArray(json.myVoteIds)) {
        setMyVoteIds(new Set(json.myVoteIds as string[]));
      }
      return;
    }

    if (json.unchanged) {
      setInfo('Ya tenías ese voto.');
      return;
    }

    startTransition(() => {
      setClans((prev) =>
        prev.map((c) => {
          if (c.id !== clanId) return c;
          return { ...c, votes: c.votes + (action === 'add' ? 1 : -1) };
        }),
      );
      setMyVoteIds(new Set(json.myVoteIds as string[]));
      setInfo(action === 'add' ? 'Voto agregado.' : 'Voto quitado.');
    });
  }

  return (
    <div className="space-y-6">
      <CneBanner
        clans={clans}
        myVoteIds={myVoteIds}
        registerLocked={Boolean(registerRemaining)}
        busyVoteId={busyVoteId}
        onToggleVote={handleToggleVote}
        onCreateClan={handleCreateClanFromBanner}
      />

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
            error
              ? 'border-danger/60 bg-danger/10 text-danger'
              : 'border-primary/60 bg-primary/10 text-primary',
          )}
        >
          {error ?? info}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="display text-lg uppercase">Ranking</h2>
          <span
            className={cn(
              'tag-tactical',
              votesLeft === 0 ? 'text-warning' : votesLeft < MAX_VOTES ? 'text-primary' : '',
            )}
          >
            Tus votos: {myVoteIds.size}/{MAX_VOTES}
          </span>
        </div>

        {sortedClans.length === 0 ? (
          <div className="hud-panel p-8 text-center text-muted-foreground">
            Sin propuestas todavía. Registrá la primera.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedClans.map((c, idx) => {
              const isMine = myVoteIds.has(c.id);
              const atLimit = votesLeft === 0 && !isMine;
              const busy = busyVoteId === c.id;
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
                    onClick={() => handleToggleVote(c.id)}
                    disabled={atLimit || busy}
                    title={atLimit ? `Llegaste al máximo de ${MAX_VOTES} votos` : undefined}
                    className={cn(
                      isMine ? 'btn-ghost' : 'btn-tactical',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {busy ? '...' : isMine ? 'Quitar' : 'Votar'}
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
