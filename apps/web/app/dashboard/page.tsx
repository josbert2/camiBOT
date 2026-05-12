import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@camibot/db';
import { TournamentCard } from '@/components/tournament-card';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [createdTournaments, participations, statsAgg, tournamentsWonCount] =
    await Promise.all([
      prisma.tournament.findMany({
        where: { creatorId: userId },
        include: {
          _count: { select: { participants: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),

      prisma.participant.findMany({
        where: { userId },
        include: {
          tournament: {
            include: { _count: { select: { participants: true } } },
          },
        },
        orderBy: { registeredAt: 'desc' },
        take: 24,
      }),

      prisma.participant.aggregate({
        where: { userId },
        _sum: { wins: true, losses: true },
        _count: { id: true },
      }),

      prisma.participant.count({
        where: { userId, status: 'WINNER' },
      }),
    ]);

  const totalWins = statsAgg._sum.wins ?? 0;
  const totalLosses = statsAgg._sum.losses ?? 0;
  const tournamentsPlayed = statsAgg._count.id;
  const winRate =
    totalWins + totalLosses > 0
      ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            [panel]
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase">
            {session.user.name ?? session.user.discordId ?? 'Sin nombre'}
          </h1>
        </div>
        <div className="flex gap-2">
          {isAdmin(session) && (
            <Link
              href="/admin"
              className="border-2 border-primary bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              Admin global
            </Link>
          )}
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="border-2 border-border-strong bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-danger hover:text-danger-foreground"
            >
              Salir
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-px border-2 border-border bg-border md:grid-cols-4">
        <StatCell label="Torneos jugados" value={tournamentsPlayed} sublabel="total" />
        <StatCell
          label="Ganados"
          value={tournamentsWonCount}
          sublabel="campeón"
          highlight
        />
        <StatCell
          label="W / L"
          value={`${totalWins} / ${totalLosses}`}
          sublabel="partidos"
        />
        <StatCell label="Win rate" value={`${winRate}%`} sublabel="ratio" />
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between border-b-2 border-border pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Torneos que creaste
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {createdTournaments.length}
          </span>
        </div>
        {createdTournaments.length === 0 ? (
          <EmptyState
            title="Todavía no creaste ningún torneo"
            hint="Crealos desde Discord con /tournament create"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {createdTournaments.map((t) => (
              <TournamentCard
                key={t.id}
                id={t.id}
                name={t.name}
                slug={t.slug}
                format={t.format}
                status={t.status}
                participantsCount={t._count.participants}
                maxParticipants={t.maxParticipants}
                createdAt={t.createdAt}
                myRole="creator"
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between border-b-2 border-border pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Donde participás
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {participations.length}
          </span>
        </div>
        {participations.length === 0 ? (
          <EmptyState
            title="Todavía no participás en ningún torneo"
            hint="Inscribite desde Discord con el botón de Registrarse"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {participations.map((p) => (
              <TournamentCard
                key={p.id}
                id={p.tournament.id}
                name={p.tournament.name}
                slug={p.tournament.slug}
                format={p.tournament.format}
                status={p.tournament.status}
                participantsCount={p.tournament._count.participants}
                maxParticipants={p.tournament.maxParticipants}
                createdAt={p.tournament.createdAt}
                myRole="participant"
                myFinalRank={p.finalRank}
                myStatus={p.status}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCell({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-card p-6">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 text-4xl font-bold tabular-nums ${
          highlight ? 'text-success' : ''
        }`}
      >
        {value}
      </div>
      <div className="text-xs uppercase text-muted-foreground">{sublabel}</div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <p className="text-sm font-bold uppercase tracking-wider">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
