import Link from 'next/link';
import {
  getBotStatus,
  getDbStatus,
  getWebStatus,
  getPhase,
  getCounts,
  type StatusValue,
} from '../lib/status';

export const revalidate = 30; // refrescar cada 30s

const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${
  process.env.DISCORD_CLIENT_ID ?? ''
}&permissions=8&scope=bot+applications.commands`;

function statusColor(v: StatusValue): string {
  switch (v) {
    case 'ONLINE':
    case 'CONNECTED':
    case 'PROD':
      return 'text-success';
    case 'OFFLINE':
    case 'DOWN':
      return 'text-danger';
    case 'DEV':
      return 'text-warning';
    default:
      return 'text-foreground';
  }
}

export default async function HomePage() {
  const [bot, db, phase, counts] = await Promise.all([
    getBotStatus(),
    getDbStatus(),
    getPhase(),
    getCounts(),
  ]);
  const web = getWebStatus();

  const cells: { k: string; v: StatusValue | string }[] = [
    { k: 'BOT', v: bot },
    { k: 'DB', v: db },
    { k: 'WEB', v: web },
    { k: 'PHASE', v: phase },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16">
      {/* Header marker */}
      <div className="mb-16 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [camibot/v0.0.0]
        </span>
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          phase_1.5:voice+brackets
        </span>
      </div>

      {/* Hero */}
      <section className="flex flex-1 flex-col justify-center">
        <h1 className="mb-8 text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-7xl">
          Host
          <br />
          tournaments
          <br />
          <span className="bg-primary px-2 text-primary-foreground">in discord.</span>
        </h1>

        <p className="mb-12 max-w-xl text-base text-muted-foreground md:text-lg">
          Single elim, double elim, round robin. Brackets, registration, check-in,
          leaderboards. Todo nativo del server.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-border-strong bg-foreground px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-background transition hover:bg-primary hover:text-primary-foreground"
          >
            Invitar bot
          </a>
          <Link
            href="/dashboard"
            className="border-2 border-border-strong bg-transparent px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-foreground hover:text-background"
          >
            Dashboard →
          </Link>
        </div>

        {/* Counts */}
        <div className="mt-12 grid grid-cols-2 gap-px border-2 border-border bg-border md:max-w-md">
          <div className="bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Torneos creados
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts.tournaments}</div>
          </div>
          <div className="bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Servers
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts.guilds}</div>
          </div>
        </div>
      </section>

      {/* Status bar */}
      <footer className="mt-16 grid grid-cols-2 gap-px border-2 border-border bg-border md:grid-cols-4">
        {cells.map((s) => (
          <div key={s.k} className="bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.k}
            </div>
            <div className={`mt-1 text-sm font-bold ${statusColor(s.v as StatusValue)}`}>
              {s.v}
            </div>
          </div>
        ))}
      </footer>
    </main>
  );
}
