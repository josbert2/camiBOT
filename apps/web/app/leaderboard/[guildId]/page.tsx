import { notFound } from 'next/navigation';
import { prisma } from '@camibot/db';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { guildId } = await params;
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { name: true },
  });
  return {
    title: guild?.name
      ? `Leaderboard — ${guild.name}`
      : 'Leaderboard — camiBOT',
  };
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { guildId } = await params;
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { id: true, name: true, icon: true, discordId: true },
  });
  if (!guild) notFound();

  const leaderboard = await prisma.leaderboard.findFirst({
    where: { guildId: guild.id, name: 'General', gameId: null },
    include: {
      entries: {
        orderBy: { points: 'desc' },
        take: 50,
        include: { user: { select: { username: true, globalName: true, avatar: true } } },
      },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 border-b-2 border-border-strong pb-6">
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [leaderboard]
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-tight md:text-5xl">
          {guild.name}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          puntos: 10 por torneo ganado · 3 por victoria · 1 por participar
        </p>
      </header>

      {!leaderboard || leaderboard.entries.length === 0 ? (
        <div className="border-2 border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-wider">
            Sin datos todavía
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            La tabla se llena automáticamente cuando se completa el primer torneo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Jugador</th>
                <th className="px-3 py-2 text-right tabular-nums">Torneos</th>
                <th className="px-3 py-2 text-right tabular-nums">🏆</th>
                <th className="px-3 py-2 text-right tabular-nums">W/L</th>
                <th className="px-3 py-2 text-right tabular-nums">Pts</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.entries.map((e, i) => {
                const name = e.user.globalName ?? e.user.username;
                const isTop3 = i < 3;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border last:border-b-0 ${
                      i === 0 ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold tabular-nums">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className={`font-bold ${isTop3 ? '' : ''}`}>{name}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {e.tournamentsPlayed}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">
                      {e.tournamentsWon}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="text-success">{e.wins}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-danger">{e.losses}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-lg font-bold tabular-nums">
                      {e.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mt-12 border-t-2 border-border-strong pt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        [guild: {guild.discordId}]
      </footer>
    </main>
  );
}
