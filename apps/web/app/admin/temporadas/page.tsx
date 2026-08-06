import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getSeasonLeaderboard } from '@/lib/season';
import { createSeason, closeSeasonAction } from './actions';

export const dynamic = 'force-dynamic';

function fmt(d: Date): string {
  return new Date(d).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function TemporadasAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session)) redirect('/admin');

  const seasons = await prisma.season.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { winner: { select: { username: true, globalName: true } } },
  });

  const active = seasons.find((s) => s.status === 'ACTIVE') ?? null;
  const activeBoard = active ? await getSeasonLeaderboard(active, 10) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            [admin / comunidad]
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase">Temporadas</h1>
        </div>
        <Link
          href="/admin"
          className="border-2 border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
        >
          ← Admin
        </Link>
      </header>

      {/* Crear temporada */}
      <section className="mb-12 hud-panel p-6">
        <div className="mb-4 tag-tactical">// NUEVA TEMPORADA</div>
        <form action={createSeason} className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="tag-tactical mb-1 block">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej: Operación Verano"
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="tag-tactical mb-1 block">Premio</span>
            <input
              name="prize"
              defaultValue="Battle Pass BlackCell"
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="tag-tactical mb-1 block">Meta de puntos (opcional)</span>
            <input
              name="targetPoints"
              type="number"
              min="1"
              placeholder="Ej: 500"
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="tag-tactical mb-1 block">Inicio</span>
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="tag-tactical mb-1 block">Cierre</span>
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-tactical">
              Crear temporada
            </button>
            {active && (
              <p className="mt-2 text-[10px] uppercase tracking-widest text-warning">
                Ya hay una temporada activa. Cerrala antes para que el ranking del feed
                use la nueva.
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Ranking en vivo de la activa */}
      {active && (
        <section className="mb-12">
          <div className="mb-3 flex items-center justify-between border-b-2 border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Ranking en vivo · {active.name}
            </h2>
            <form action={closeSeasonAction}>
              <input type="hidden" name="seasonId" value={active.id} />
              <button
                type="submit"
                className="border-2 border-danger px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-danger transition hover:bg-danger hover:text-danger-foreground"
              >
                Cerrar y fijar ganador
              </button>
            </form>
          </div>
          {activeBoard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía sin puntos.</p>
          ) : (
            <ol className="divide-y divide-border border-2 border-border">
              {activeBoard.map((r) => (
                <li key={r.user.id} className="flex items-center gap-4 px-4 py-2">
                  <span className="display w-6 text-center text-lg">{r.rank}</span>
                  <span className="flex-1 truncate text-sm">{r.user.name}</span>
                  <span className="text-xs tabular-nums text-danger">{r.points} pts</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {r.clips} clips
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* Historial */}
      <section>
        <div className="mb-3 border-b-2 border-border pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Historial
          </h2>
        </div>
        {seasons.length === 0 ? (
          <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Todavía no creaste ninguna temporada.
          </div>
        ) : (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">Temporada</th>
                  <th className="px-3 py-2 text-left">Premio</th>
                  <th className="px-3 py-2 text-left">Rango</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Ganador</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-bold">{s.name}</td>
                    <td className="px-3 py-2 text-xs">{s.prize}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmt(s.startsAt)} → {fmt(s.endsAt)}
                    </td>
                    <td
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                        s.status === 'ACTIVE' ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {s.status === 'ACTIVE' ? 'Activa' : 'Cerrada'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.winner
                        ? `${s.winner.globalName ?? s.winner.username} (${s.winnerPoints ?? 0} pts)`
                        : s.status === 'CLOSED'
                          ? 'sin participantes'
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
