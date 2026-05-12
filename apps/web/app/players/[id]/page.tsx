import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ChampionIcon,
  Target02Icon,
  MedalFirstPlaceIcon,
  StarIcon,
  Shield01Icon,
  MedalIcon,
  Fire02Icon,
  FlashIcon,
  RocketIcon,
  LockedIcon,
  DiamondIcon,
  RefreshIcon,
  GameControllerIcon,
} from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import type { Metadata } from 'next';
import type { TournamentFormat, TournamentStatus } from '@camibot/db';
import {
  computeStreaks,
  computeHeadToHead,
  computeAchievements,
} from '@/lib/player-stats';
import { RankBadge } from '@/components/rank-badge';

// Mapeo iconKey → HugeIcon component
const ICON_MAP: Record<string, typeof Target02Icon> = {
  target: Target02Icon,
  crosshair: Target02Icon,
  champion: ChampionIcon,
  'medal-star': MedalFirstPlaceIcon,
  star: StarIcon,
  shield: Shield01Icon,
  medal: MedalIcon,
  fire: Fire02Icon,
  flash: FlashIcon,
  rocket: RocketIcon,
  lock: LockedIcon,
  diamond: DiamondIcon,
  refresh: RefreshIcon,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Borrador',
  REGISTRATION: 'Inscripciones',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const FORMAT_LABEL: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: 'Single elim',
  DOUBLE_ELIMINATION: 'Doble elim',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Suizo',
};

function statusClass(s: TournamentStatus): string {
  switch (s) {
    case 'IN_PROGRESS':
      return 'text-primary';
    case 'COMPLETED':
      return 'text-success';
    case 'CANCELLED':
      return 'text-danger';
    case 'REGISTRATION':
    case 'CHECK_IN':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
}

function rankLabel(rank: number | null, status: string): string {
  if (status === 'WINNER') return 'CAMPEÓN';
  if (rank === null) return '—';
  if (rank === 2) return '2° lugar';
  if (rank === 3) return '3° lugar';
  return `#${rank}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: { select: { participations: true } },
      participations: { select: { status: true } },
    },
  });
  if (!u) return { title: 'Operador' };
  const name = u.globalName ?? u.username;
  const wins = u.participations.filter((p) => p.status === 'WINNER').length;
  const played = u._count.participations;
  const desc = `Perfil de ${name} en Tournify. ${played} torneos jugados, ${wins} ganados. Stats, killstreak, condecoraciones y rivalidades.`;
  return {
    title: name,
    description: desc,
    openGraph: { title: name, description: desc, type: 'profile' },
    twitter: { card: 'summary', title: name, description: desc },
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      participations: {
        include: {
          tournament: {
            include: {
              guild: { select: { name: true, discordId: true } },
              _count: { select: { participants: true } },
            },
          },
        },
        orderBy: { registeredAt: 'desc' },
      },
      leaderboardEntries: {
        include: {
          leaderboard: { include: { guild: { select: { name: true, id: true } } } },
        },
      },
    },
  });

  if (!user) notFound();

  // Cargar todos los matches donde participó (vía sus Participants)
  const myParticipantIds = user.participations.map((p) => p.id);
  const allMatches = await prisma.match.findMany({
    where: {
      status: 'COMPLETED',
      OR: [
        { participant1Id: { in: myParticipantIds } },
        { participant2Id: { in: myParticipantIds } },
      ],
    },
    include: {
      participant1: { select: { id: true, userId: true } },
      participant2: { select: { id: true, userId: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  // Nombres de todos los usuarios involucrados (para H2H)
  const allUserIds = new Set<string>();
  for (const m of allMatches) {
    if (m.participant1?.userId) allUserIds.add(m.participant1.userId);
    if (m.participant2?.userId) allUserIds.add(m.participant2.userId);
  }
  const allUsers = await prisma.user.findMany({
    where: { id: { in: [...allUserIds] } },
    select: { id: true, username: true, globalName: true },
  });
  const nameByUserId = new Map(
    allUsers.map((u) => [u.id, u.globalName ?? u.username]),
  );

  const streaks = computeStreaks(
    myParticipantIds,
    allMatches.map((m) => ({
      completedAt: m.completedAt,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      winnerId: m.winnerId,
    })),
  );

  const h2h = computeHeadToHead(
    user.id,
    allMatches.map((m) => ({
      completedAt: m.completedAt,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      winnerId: m.winnerId,
      participant1: m.participant1
        ? { participantId: m.participant1.id, userId: m.participant1.userId }
        : null,
      participant2: m.participant2
        ? { participantId: m.participant2.id, userId: m.participant2.userId }
        : null,
    })),
    nameByUserId,
  );

  // Para achievements: perfect-runs y underdog-runs
  let perfectRuns = 0;
  let underdogRuns = 0;
  let comebackWins = 0;
  for (const p of user.participations) {
    if (p.status === 'WINNER') {
      if (p.losses === 0) perfectRuns++;
      const totalSeeds = p.tournament._count.participants;
      if (p.seed && totalSeeds > 0 && p.seed > totalSeeds / 2) underdogRuns++;
      if (p.tournament.format === 'DOUBLE_ELIMINATION' && p.losses >= 1) {
        // Si ganó pero tuvo al menos una loss en double elim, vino del LB
        comebackWins++;
      }
    }
  }

  const name = user.globalName ?? user.username;
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
    : null;

  const totalWins = user.participations.reduce((s, p) => s + p.wins, 0);
  const totalLosses = user.participations.reduce((s, p) => s + p.losses, 0);
  const tournamentsPlayed = user.participations.length;
  const tournamentsWon = user.participations.filter((p) => p.status === 'WINNER').length;
  const totalPoints = user.leaderboardEntries.reduce((s, e) => s + e.points, 0);
  const winRate =
    totalWins + totalLosses > 0
      ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
      : 0;
  const kda =
    totalLosses === 0 ? (totalWins > 0 ? '∞' : '0.00') : (totalWins / totalLosses).toFixed(2);

  const achievements = computeAchievements({
    tournamentsPlayed,
    tournamentsWon,
    totalWins,
    totalLosses,
    bestStreak: streaks.best,
    participationsWithStatus: user.participations.map((p) => ({
      status: p.status,
      finalRank: p.finalRank,
      seed: p.seed,
    })),
    perfectRuns,
    underdogRuns,
    comebackWins,
  });
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/players"
        className="mb-6 inline-flex items-center gap-2 tag-tactical hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3" />
        <span>Volver al ranking</span>
      </Link>

      {/* Header — dossier estilo expediente */}
      <header className="mb-8 hud-panel flex items-start gap-6 p-6">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name}
            className="h-28 w-28 border-2 border-primary"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center border-2 border-primary bg-muted display text-5xl text-primary">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 tag-tactical">
            <HugeiconsIcon icon={GameControllerIcon} className="h-3.5 w-3.5" />
            <span>// DOSSIER OPERADOR</span>
          </div>
          <h1 className="stencil mt-1 text-4xl md:text-6xl">{name}</h1>
          {user.username !== name && (
            <div className="mt-1 text-xs text-muted-foreground">@{user.username}</div>
          )}
          <div className="mt-3">
            <RankBadge points={totalPoints} size="lg" withProgress />
          </div>
          <div className="mt-2 inline-block border border-border bg-muted px-2 py-1">
            <span className="tag-tactical">ID:</span>{' '}
            <code className="text-[10px] text-foreground">{user.discordId}</code>
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Ops" value={tournamentsPlayed} />
        <Stat label="Wins" value={tournamentsWon} highlight />
        <Stat label="Kills" value={totalWins} sub="totales" />
        <Stat label="Deaths" value={totalLosses} sub="totales" />
        <Stat label="KDA" value={kda} />
        <Stat label="XP" value={totalPoints} sub={`${winRate}% WR`} />
      </div>

      {/* Streaks */}
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="hud-panel flex items-center gap-3 p-4">
          {streaks.current >= 3 && (
            <HugeiconsIcon icon={Fire02Icon} className="h-8 w-8 text-accent" />
          )}
          <div>
            <div className="tag-tactical">Killstreak actual</div>
            <div className="display mt-1 text-3xl tabular-nums text-accent">
              {streaks.current}
            </div>
          </div>
        </div>
        <div className="hud-panel flex items-center gap-3 p-4">
          <HugeiconsIcon icon={FlashIcon} className="h-8 w-8 text-primary" />
          <div>
            <div className="tag-tactical">Récord personal</div>
            <div className="display mt-1 text-3xl tabular-nums text-primary">
              {streaks.best}
            </div>
          </div>
        </div>
      </div>

      {/* Medallas / Logros */}
      <section className="mt-12">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 tag-tactical">
            <HugeiconsIcon icon={MedalIcon} className="h-3.5 w-3.5" />
            <span>// Condecoraciones</span>
          </div>
          <span className="display text-sm tabular-nums text-primary">
            {String(unlockedCount).padStart(2, '0')} / {String(achievements.length).padStart(2, '0')}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => {
            const Icon = ICON_MAP[a.iconKey] ?? MedalIcon;
            return (
              <div
                key={a.id}
                className={`border p-3 transition ${
                  a.unlocked
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card/50 opacity-40'
                }`}
                title={a.description}
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={Icon}
                    className={`h-8 w-8 ${a.unlocked ? 'text-accent' : 'text-muted-foreground'}`}
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="display truncate text-sm tracking-wider">
                      {a.name}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {a.description}
                    </div>
                  </div>
                </div>
                {a.progress && !a.unlocked && (
                  <div className="mt-2">
                    <div className="h-1 overflow-hidden bg-border">
                      <div
                        className="h-full bg-warning"
                        style={{
                          width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                      {a.progress.current} / {a.progress.target}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* H2H */}
      {h2h.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 border-b-2 border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Rivalidades (head-to-head)
            </h2>
          </div>
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">Oponente</th>
                  <th className="px-3 py-2 text-right tabular-nums">W</th>
                  <th className="px-3 py-2 text-right tabular-nums">L</th>
                  <th className="px-3 py-2 text-right tabular-nums">Total</th>
                  <th className="px-3 py-2 text-right">Ventaja</th>
                </tr>
              </thead>
              <tbody>
                {h2h.map((r) => {
                  const total = r.wins + r.losses;
                  const diff = r.wins - r.losses;
                  return (
                    <tr
                      key={r.opponentUserId}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2 font-bold">
                        <Link
                          href={`/players/${r.opponentUserId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {r.opponentName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-success">
                        {r.wins}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-danger">
                        {r.losses}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{total}</td>
                      <td
                        className={`px-3 py-2 text-right text-xs font-bold ${
                          diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-muted-foreground'
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Leaderboards por server */}
      {user.leaderboardEntries.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 border-b-2 border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Por servidor
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {user.leaderboardEntries.map((e) => (
              <Link
                key={e.id}
                href={`/leaderboard/${e.leaderboard.guild.id}`}
                className="flex items-center justify-between border-2 border-border bg-card px-4 py-3 transition hover:border-border-strong"
              >
                <div>
                  <div className="font-bold">{e.leaderboard.guild.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.tournamentsPlayed} torneos · {e.tournamentsWon}🏆 · {e.wins}W/{e.losses}L
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums">{e.points}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Historial de torneos */}
      <section className="mt-12">
        <div className="mb-3 border-b-2 border-border pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Historial de torneos
          </h2>
        </div>
        {user.participations.length === 0 ? (
          <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Todavía no participó en ningún torneo.
          </div>
        ) : (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">Torneo</th>
                  <th className="px-3 py-2 text-left">Servidor</th>
                  <th className="px-3 py-2 text-left">Formato</th>
                  <th className="px-3 py-2 text-left">Resultado</th>
                  <th className="px-3 py-2 text-right tabular-nums">W/L</th>
                  <th className="px-3 py-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {user.participations.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-b-0 hover:bg-card"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/t/${p.tournament.id}`}
                        className="font-bold underline-offset-2 hover:underline"
                      >
                        {p.tournament.name}
                      </Link>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {p.tournament.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.tournament.guild.name}</td>
                    <td className="px-3 py-2 text-xs">{FORMAT_LABEL[p.tournament.format]}</td>
                    <td className={`px-3 py-2 text-xs font-bold ${statusClass(p.tournament.status)}`}>
                      {p.tournament.status === 'COMPLETED'
                        ? rankLabel(p.finalRank, p.status)
                        : STATUS_LABEL[p.tournament.status]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="text-success">{p.wins}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-danger">{p.losses}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {new Date(p.registeredAt).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
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

function Stat({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tabular-nums ${highlight ? 'text-success' : ''}`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] uppercase text-muted-foreground">{sub}</div>}
    </div>
  );
}
