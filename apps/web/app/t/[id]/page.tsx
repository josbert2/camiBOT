import { notFound } from 'next/navigation';
import { prisma } from '@camibot/db';
import { BracketSVG } from '@/components/bracket-svg';
import { StandingsTable } from '@/components/standings-table';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  REGISTRATION: 'Registro abierto',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Eliminación simple',
  DOUBLE_ELIMINATION: 'Doble eliminación',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Suizo',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: tournament?.name ? `${tournament.name} — camiBOT` : 'Torneo — camiBOT',
  };
}

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true }, orderBy: { seed: 'asc' } },
      matches: { orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }] },
      guild: { select: { name: true, icon: true } },
    },
  });

  if (!tournament) notFound();

  const winner =
    tournament.status === 'COMPLETED'
      ? tournament.participants.find((p) => p.status === 'WINNER')
      : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <header className="mb-8 border-b-2 border-border-strong pb-6">
        <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>[torneo]</span>
          <span>·</span>
          <span>{tournament.guild.name}</span>
          <span>·</span>
          <span className="text-foreground">{STATUS_LABELS[tournament.status] ?? tournament.status}</span>
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-tight md:text-5xl">
          {tournament.name}
        </h1>
        {tournament.description && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{tournament.description}</p>
        )}

        {winner && (
          <div className="mt-6 inline-block border-2 border-foreground bg-primary px-4 py-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-primary-foreground/70">
              Ganador
            </div>
            <div className="text-lg font-bold uppercase text-primary-foreground">
              🏆 {winner.user.globalName ?? winner.user.username}
            </div>
          </div>
        )}
      </header>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-px border-2 border-border bg-border md:grid-cols-4">
        <Stat label="Formato" value={FORMAT_LABELS[tournament.format] ?? tournament.format} />
        <Stat
          label="Participantes"
          value={`${tournament.participants.length} / ${tournament.maxParticipants}`}
        />
        <Stat label="Best of" value={`BO${tournament.bestOf}`} />
        <Stat
          label="Matches"
          value={`${tournament.matches.filter((m) => m.status === 'COMPLETED').length} / ${tournament.matches.length}`}
        />
      </div>

      {/* Bracket / Tabla según formato */}
      {(() => {
        const allMatches = tournament.matches.map((m) => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          winnerId: m.winnerId,
          scoreP1: m.scoreP1,
          scoreP2: m.scoreP2,
          status: m.status,
          nextMatchId: m.nextMatchId,
          bracketSide: m.bracketSide,
        }));
        const participants = tournament.participants.map((p) => ({
          id: p.id,
          name: p.user.globalName ?? p.user.username,
          seed: p.seed,
        }));

        if (tournament.format === 'ROUND_ROBIN') {
          return (
            <section className="mb-12">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                [tabla de posiciones]
              </div>
              <StandingsTable
                participants={participants}
                matches={tournament.matches.map((m) => ({
                  participant1Id: m.participant1Id,
                  participant2Id: m.participant2Id,
                  winnerId: m.winnerId,
                  status: m.status,
                }))}
                champion={winner?.id ?? null}
              />
            </section>
          );
        }

        if (tournament.format === 'DOUBLE_ELIMINATION') {
          const wb = allMatches.filter((m) => m.bracketSide === 'WINNERS');
          const lb = allMatches.filter((m) => m.bracketSide === 'LOSERS');
          const gf = allMatches.filter((m) => m.bracketSide === 'GRAND_FINAL');
          return (
            <section className="mb-12 space-y-10">
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  [winners bracket]
                </div>
                <BracketSVG matches={wb} participants={participants} />
              </div>
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  [losers bracket]
                </div>
                <BracketSVG matches={lb} participants={participants} />
              </div>
              {gf.length > 0 && (
                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    [grand final]
                  </div>
                  <BracketSVG matches={gf} participants={participants} />
                </div>
              )}
            </section>
          );
        }

        // Single elim (default)
        return (
          <section className="mb-12">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              [bracket]
            </div>
            <BracketSVG matches={allMatches} participants={participants} />
          </section>
        );
      })()}

      {/* Participants */}
      <section>
        <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [participantes]
        </div>
        <div className="grid grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-3 md:grid-cols-4">
          {tournament.participants.map((p) => (
            <div
              key={p.id}
              className={`bg-card px-4 py-3 ${p.status === 'WINNER' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                seed {p.seed ? String(p.seed).padStart(2, '0') : '--'}
              </div>
              <div className="mt-1 truncate text-sm font-bold">
                {p.user.globalName ?? p.user.username}
              </div>
              <div className="text-[10px] uppercase text-muted-foreground">
                {p.wins}W · {p.losses}L
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t-2 border-border-strong pt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        [id: {tournament.id}] · [slug: {tournament.slug}]
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
