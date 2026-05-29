'use client';

import { useEffect, useState } from 'react';
import type { ClanRow } from './board';

type Props = {
  clans: ClanRow[];
  myVoteIds: Set<string>;
  votesLeft: number;
  registerLocked: boolean;
  busyVoteId: string | null;
  onToggleVote: (clanId: string) => void | Promise<void>;
  onCreateClan: (name: string) => void | Promise<unknown>;
};

const TARGET_A = 'vzltm';
const TARGET_B = 'vnltm';

function findClan(clans: ClanRow[], slugOrName: string): ClanRow | undefined {
  const needle = slugOrName.toLowerCase();
  return clans.find(
    (c) => c.slug.toLowerCase() === needle || c.name.toLowerCase().replace(/\s+/g, '') === needle,
  );
}

function fmt(n: number): string {
  return n.toLocaleString('es-CL');
}

export function CneBanner({
  clans,
  myVoteIds,
  votesLeft,
  registerLocked,
  busyVoteId,
  onToggleVote,
  onCreateClan,
}: Props) {
  const a = findClan(clans, TARGET_A);
  const b = findClan(clans, TARGET_B);

  const votesA = a?.votes ?? 0;
  const votesB = b?.votes ?? 0;
  const total = votesA + votesB;
  const pctA = total > 0 ? ((votesA / total) * 100).toFixed(2) : '0.00';
  const pctB = total > 0 ? ((votesB / total) * 100).toFixed(2) : '0.00';
  const lead = Math.abs(votesA - votesB);
  const leader = votesA === votesB ? null : votesA > votesB ? 'VZLTM' : 'VNLTM';

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  let timeLabel = '';
  let dateLabel = '';
  if (mounted) {
    const now = new Date();
    timeLabel = now.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Tegucigalpa',
    });
    dateLabel = now.toLocaleDateString('es-HN', {
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Tegucigalpa',
    });
  }

  return (
    <section
      className="mb-6 border-2 border-border-strong bg-[#f4f5f7] p-6 text-[#1e293b]"
      aria-label="Anuncio CNE: resultados parciales"
    >
      <div className="mb-4 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/63/CNE_logo.svg"
          alt="Logo CNE Honduras"
          className="h-16 w-auto"
        />
      </div>

      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#dc2626]">
          Votaciones Superiores · CNE
        </div>
        <h2 className="mt-1 text-3xl font-black uppercase tracking-tight text-[#0f172a]">
          Resultados parciales
        </h2>
        <p className="mt-1 text-xs text-[#64748b]">
          La Junta Directiva del CNE ha decidido los resultados.
          {mounted && ` Actualización ${timeLabel}, ${dateLabel}.`}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CandidateCard
          name="VZLTM"
          clan={a}
          votes={votesA}
          pct={pctA}
          ringColor="#dc2626"
          isLeader={leader === 'VZLTM'}
          isVoted={a ? myVoteIds.has(a.id) : false}
          votesLeft={votesLeft}
          registerLocked={registerLocked}
          busy={Boolean(a && busyVoteId === a.id)}
          onToggleVote={onToggleVote}
          onCreateClan={onCreateClan}
        />
        <CandidateCard
          name="VNLTM"
          clan={b}
          votes={votesB}
          pct={pctB}
          ringColor="#2563eb"
          isLeader={leader === 'VNLTM'}
          isVoted={b ? myVoteIds.has(b.id) : false}
          votesLeft={votesLeft}
          registerLocked={registerLocked}
          busy={Boolean(b && busyVoteId === b.id)}
          onToggleVote={onToggleVote}
          onCreateClan={onCreateClan}
        />
      </div>

      <div className="mt-6 border-2 border-[#1e293b]/20 bg-white px-4 py-3 text-center">
        {leader ? (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#64748b]">
              Ventaja de {leader}:
            </span>{' '}
            <span className="text-base font-black text-[#0f172a]">
              {fmt(lead)} {lead === 1 ? 'voto' : 'votos'}
            </span>
          </>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#64748b]">
            {total === 0 ? 'Sin votos todavía' : 'Empate técnico'}
          </span>
        )}
      </div>
    </section>
  );
}

function CandidateCard({
  name,
  clan,
  votes,
  pct,
  ringColor,
  isLeader,
  isVoted,
  votesLeft,
  registerLocked,
  busy,
  onToggleVote,
  onCreateClan,
}: {
  name: string;
  clan: ClanRow | undefined;
  votes: number;
  pct: string;
  ringColor: string;
  isLeader: boolean;
  isVoted: boolean;
  votesLeft: number;
  registerLocked: boolean;
  busy: boolean;
  onToggleVote: (clanId: string) => void | Promise<void>;
  onCreateClan: (name: string) => void | Promise<unknown>;
}) {
  const atLimit = votesLeft === 0 && !isVoted;
  return (
    <div className="flex flex-col items-center border border-[#e2e8f0] bg-white p-4">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full border-4 font-black text-[#0f172a]"
        style={{ borderColor: ringColor }}
      >
        <span className="text-xl tracking-tight">{name}</span>
      </div>
      <div className="mt-3 text-center">
        <div className="text-sm font-bold uppercase tracking-wider text-[#0f172a]">{name}</div>
        <div className="text-[10px] uppercase tracking-widest text-[#64748b]">votos</div>
        <div
          className="mt-1 text-2xl font-black"
          style={{ color: isLeader ? ringColor : '#0f172a' }}
        >
          {fmt(votes)}
        </div>
        <div className="text-sm font-bold" style={{ color: ringColor }}>
          {pct}%
        </div>
      </div>

      <div className="mt-4 w-full">
        {clan ? (
          <button
            type="button"
            onClick={() => onToggleVote(clan.id)}
            disabled={busy || atLimit}
            title={atLimit ? 'Ya usaste tus 5 votos' : undefined}
            className="w-full border-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: ringColor,
              backgroundColor: isVoted ? ringColor : 'transparent',
              color: isVoted ? '#fff' : ringColor,
            }}
          >
            {busy
              ? '...'
              : isVoted
                ? 'Quitar voto'
                : atLimit
                  ? 'Sin votos disponibles'
                  : `Votar por ${name}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCreateClan(name)}
            disabled={registerLocked}
            title={registerLocked ? 'Ya registraste un nombre en las últimas 24h' : undefined}
            className="w-full border-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: ringColor,
              color: ringColor,
            }}
          >
            {registerLocked ? 'Registro bloqueado 24h' : `Postular ${name}`}
          </button>
        )}
      </div>
    </div>
  );
}
