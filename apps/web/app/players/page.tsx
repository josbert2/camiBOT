import { prisma } from '@camibot/db';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, RankingIcon } from '@hugeicons/core-free-icons';
import type { Metadata } from 'next';
import { getRankProgress } from '@/lib/ranks';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ranking — Tournify',
};

export default async function PlayersPage() {
  const users = await prisma.user.findMany({
    where: { participations: { some: {} } },
    include: {
      _count: { select: { participations: true } },
      participations: {
        select: { wins: true, losses: true, status: true },
      },
      leaderboardEntries: {
        select: { points: true, tournamentsWon: true },
      },
    },
  });

  const rows = users
    .map((u) => {
      const wins = u.participations.reduce((s, p) => s + p.wins, 0);
      const losses = u.participations.reduce((s, p) => s + p.losses, 0);
      const tournamentsPlayed = u._count.participations;
      const tournamentsWon = u.participations.filter((p) => p.status === 'WINNER').length;
      const points = u.leaderboardEntries.reduce((s, e) => s + e.points, 0);
      return {
        id: u.id,
        name: u.globalName ?? u.username,
        wins,
        losses,
        tournamentsPlayed,
        tournamentsWon,
        points,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.tournamentsWon !== a.tournamentsWon) return b.tournamentsWon - a.tournamentsWon;
      return b.wins - a.wins;
    });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={RankingIcon} className="h-3.5 w-3.5" />
          <span>// OPERADORES</span>
        </div>
        <h1 className="stencil text-5xl md:text-6xl">Ranking general</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Cross-base · operadores con misiones registradas
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="hud-panel px-6 py-16 text-center">
          <p className="display text-lg">Sin operadores</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se llena cuando alguien se inscribe a un torneo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-3 py-2 text-left tag-tactical">#</th>
                <th className="px-3 py-2 text-left tag-tactical">Rango</th>
                <th className="px-3 py-2 text-left tag-tactical">Operador</th>
                <th className="px-3 py-2 text-right tag-tactical">Ops</th>
                <th className="px-3 py-2 text-right tag-tactical">Wins</th>
                <th className="px-3 py-2 text-right tag-tactical">K/D</th>
                <th className="px-3 py-2 text-right tag-tactical">KDA</th>
                <th className="px-3 py-2 text-right tag-tactical">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const kda =
                  r.losses === 0
                    ? r.wins > 0
                      ? '∞'
                      : '0.00'
                    : (r.wins / r.losses).toFixed(2);
                const kdaClass =
                  r.losses === 0 && r.wins > 0
                    ? 'text-accent'
                    : r.wins > r.losses
                      ? 'text-success'
                      : r.wins === r.losses
                        ? 'text-foreground'
                        : 'text-danger';
                const rank = getRankProgress(r.points).current;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-border last:border-b-0 ${
                      i === 0 ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className={`px-3 py-2 display text-xs ${rank.color}`}>
                      {rank.short}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <Link
                        href={`/players/${r.id}`}
                        className="flex items-center gap-2 underline-offset-2 hover:underline"
                      >
                        {i === 0 && (
                          <HugeiconsIcon
                            icon={ChampionIcon}
                            className="h-4 w-4 text-accent"
                          />
                        )}
                        <span>{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.tournamentsPlayed}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">
                      {r.tournamentsWon}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="text-success">{r.wins}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-danger">{r.losses}</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${kdaClass}`}>
                      {kda}
                    </td>
                    <td className="display px-3 py-2 text-right text-xl tabular-nums text-primary">
                      {r.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
