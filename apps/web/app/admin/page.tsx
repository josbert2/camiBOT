import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { prisma } from '@camibot/db';
import { isAdmin } from '@/lib/admin';
import type { TournamentFormat, TournamentStatus } from '@camibot/db';

export const dynamic = 'force-dynamic';

interface SearchParamsP {
  searchParams: Promise<{
    status?: string;
    format?: string;
  }>;
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
  FFA: 'FFA',
  GROUP_STAGE: 'Grupos',
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

export default async function AdminPage({ searchParams }: SearchParamsP) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
        <div className="border-2 border-danger bg-card p-8 text-center">
          <div className="mb-2 text-xs uppercase tracking-[0.3em] text-danger">
            [acceso denegado]
          </div>
          <h1 className="text-2xl font-bold uppercase">Solo admin</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Estás logueado como{' '}
            <span className="font-bold text-foreground">
              {session.user.name ?? session.user.discordId}
            </span>{' '}
            pero no estás en la lista de admins.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block border-2 border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
          >
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  const { status, format } = await searchParams;

  const where = {
    ...(status && status in STATUS_LABEL
      ? { status: status as TournamentStatus }
      : {}),
    ...(format && format in FORMAT_LABEL
      ? { format: format as TournamentFormat }
      : {}),
  };

  const [
    tournaments,
    totals,
    active,
    completed,
    cancelled,
    totalUsers,
    totalGuilds,
    totalParticipants,
  ] = await Promise.all([
    prisma.tournament.findMany({
      where,
      include: {
        _count: { select: { participants: true, matches: true } },
        creator: { select: { username: true, globalName: true } },
        guild: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.tournament.count(),
    prisma.tournament.count({
      where: { status: { in: ['REGISTRATION', 'CHECK_IN', 'IN_PROGRESS'] } },
    }),
    prisma.tournament.count({ where: { status: 'COMPLETED' } }),
    prisma.tournament.count({ where: { status: 'CANCELLED' } }),
    prisma.user.count(),
    prisma.guild.count(),
    prisma.participant.count(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            [admin global]
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase">
            {session.user.name ?? 'admin'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="border-2 border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
          >
            Mi panel
          </Link>
        </div>
      </header>

      {/* Stats globales */}
      <div className="grid gap-px border-2 border-border bg-border md:grid-cols-4">
        <StatCell label="Torneos" value={totals} sublabel="totales" />
        <StatCell label="Activos" value={active} sublabel="en curso" highlight />
        <StatCell label="Completados" value={completed} sublabel="finalizados" />
        <StatCell label="Cancelados" value={cancelled} sublabel="abortados" />
      </div>
      <div className="mt-px grid gap-px border-2 border-border bg-border md:grid-cols-3">
        <StatCell label="Usuarios" value={totalUsers} sublabel="registrados" />
        <StatCell label="Servers" value={totalGuilds} sublabel="con el bot" />
        <StatCell
          label="Participantes"
          value={totalParticipants}
          sublabel="inscripciones totales"
        />
      </div>

      {/* Filtros */}
      <section className="mt-12">
        <div className="mb-3 flex items-center justify-between border-b-2 border-border pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Todos los torneos
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            mostrando {tournaments.length}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip
            label="Todos"
            href="/admin"
            active={!status && !format}
          />
          {(Object.keys(STATUS_LABEL) as TournamentStatus[]).map((s) => (
            <FilterChip
              key={s}
              label={STATUS_LABEL[s]}
              href={`/admin?status=${s}`}
              active={status === s}
            />
          ))}
        </div>

        {tournaments.length === 0 ? (
          <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No hay torneos con esos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">Torneo</th>
                  <th className="px-3 py-2 text-left">Server</th>
                  <th className="px-3 py-2 text-left">Creador</th>
                  <th className="px-3 py-2 text-left">Formato</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right tabular-nums">Inscriptos</th>
                  <th className="px-3 py-2 text-right tabular-nums">Matches</th>
                  <th className="px-3 py-2 text-right">Creado</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border last:border-b-0 hover:bg-card"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/t/${t.id}`}
                        className="font-bold underline-offset-2 hover:underline"
                      >
                        {t.name}
                      </Link>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {t.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{t.guild.name}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.creator.globalName ?? t.creator.username}
                    </td>
                    <td className="px-3 py-2 text-xs">{FORMAT_LABEL[t.format]}</td>
                    <td
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${statusClass(
                        t.status,
                      )}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t._count.participants} / {t.maxParticipants}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t._count.matches}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
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

function StatCell({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: number;
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
          highlight ? 'text-primary' : ''
        }`}
      >
        {value}
      </div>
      <div className="text-xs uppercase text-muted-foreground">{sublabel}</div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: Route;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`border-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-transparent text-muted-foreground hover:border-border-strong hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
