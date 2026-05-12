import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DiscordIcon,
  DashboardSquare01Icon,
  TargetIcon,
  Database01Icon,
  GlobeIcon,
  WorkflowSquare06Icon,
  CpuIcon,
  ServerStack03Icon,
} from '@hugeicons/core-free-icons';
import {
  getBotStatus,
  getDbStatus,
  getWebStatus,
  getPhase,
  getCounts,
  type StatusValue,
} from '../lib/status';

export const revalidate = 30;

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

  const cells: { k: string; v: StatusValue | string; icon: typeof CpuIcon }[] = [
    { k: 'BOT', v: bot, icon: CpuIcon },
    { k: 'DB', v: db, icon: Database01Icon },
    { k: 'WEB', v: web, icon: GlobeIcon },
    { k: 'OPS', v: phase, icon: WorkflowSquare06Icon },
  ];

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-60px)] max-w-5xl flex-col px-6 py-12">
      {/* Header marker */}
      <div className="mb-12 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={TargetIcon} className="h-3.5 w-3.5 text-primary" />
          <span>OPSEC // CAMIBOT_v0.0.0</span>
        </div>
        <span className="tag-tactical text-primary">{phase}</span>
      </div>

      {/* Hero */}
      <section className="flex flex-1 flex-col justify-center">
        <h1 className="stencil mb-6 text-6xl leading-[0.9] md:text-8xl">
          DEPLOY
          <br />
          TOURNAMENTS
          <br />
          <span className="text-primary">// IN DISCORD</span>
        </h1>

        <p className="mb-10 max-w-2xl text-sm text-muted-foreground md:text-base">
          Single elim · Double elim · Round robin · Teams 2v2/3v3. Brackets, check-in
          con timer, voice channels por match, leaderboards persistentes. Operación
          completa nativa del servidor.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tactical"
          >
            <HugeiconsIcon icon={DiscordIcon} className="h-5 w-5" />
            <span>Reclutar bot</span>
          </a>
          <Link href="/dashboard" className="btn-ghost">
            <HugeiconsIcon icon={DashboardSquare01Icon} className="h-5 w-5" />
            <span>Acceder a HQ</span>
          </Link>
        </div>

        {/* Counts */}
        <div className="mt-12 grid grid-cols-2 gap-2 md:max-w-md md:grid-cols-2">
          <div className="hud-panel p-4">
            <div className="tag-tactical">Operaciones</div>
            <div className="display mt-1 text-3xl tabular-nums text-primary">
              {String(counts.tournaments).padStart(3, '0')}
            </div>
          </div>
          <div className="hud-panel p-4">
            <div className="tag-tactical">Bases activas</div>
            <div className="display mt-1 text-3xl tabular-nums text-primary">
              {String(counts.guilds).padStart(3, '0')}
            </div>
          </div>
        </div>
      </section>

      {/* Status bar HUD */}
      <footer className="mt-12">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={ServerStack03Icon} className="h-3.5 w-3.5" />
          <span>SISTEMAS // LIVE</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {cells.map((s) => (
            <div key={s.k} className="hud-panel flex items-center gap-3 p-3">
              <HugeiconsIcon
                icon={s.icon}
                className={`h-6 w-6 ${statusColor(s.v as StatusValue)}`}
              />
              <div className="min-w-0 flex-1">
                <div className="tag-tactical">{s.k}</div>
                <div
                  className={`display text-sm tracking-widest ${statusColor(s.v as StatusValue)}`}
                >
                  {s.v}
                </div>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
