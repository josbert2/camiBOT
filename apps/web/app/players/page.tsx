import { prisma } from '@camibot/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Jugadores — camiBOT',
};

export default async function PlayersPage() {
  // Agregamos por User: torneos jugados, ganados, W/L, puntos totales (suma cross-guild).
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 border-b-2 border-border-strong pb-6">
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [jugadores]
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-tight md:text-5xl">
          Ranking general
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Cross-server · todos los jugadores con al menos 1 torneo jugado
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-wider">Sin jugadores todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se llena automáticamente cuando alguien se inscribe a un torneo.
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
                <th className="px-3 py-2 text-right tabular-nums">KDA</th>
                <th className="px-3 py-2 text-right tabular-nums">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                // KDA = wins / max(losses, 1). Perfect (sin perdidas) muestra "∞".
                const kda =
                  r.losses === 0
                    ? r.wins > 0
                      ? '∞'
                      : '0.00'
                    : (r.wins / r.losses).toFixed(2);
                const kdaClass =
                  r.losses === 0 && r.wins > 0
                    ? 'text-warning'
                    : r.wins > r.losses
                      ? 'text-success'
                      : r.wins === r.losses
                        ? 'text-foreground'
                        : 'text-danger';
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-border last:border-b-0 ${
                      i === 0 ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold tabular-nums">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="px-3 py-2 font-bold">{r.name}</td>
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
                    <td className="px-3 py-2 text-right text-lg font-bold tabular-nums">
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
