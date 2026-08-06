import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, FireIcon } from '@hugeicons/core-free-icons';
import type { Season } from '@camibot/db';
import type { LeaderboardRow, SeasonStanding } from '@/lib/season';

function daysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000));
}

/** Banner de la temporada activa: meta, premio, countdown, líder y tu posición. */
export function SeasonBanner({
  season,
  leader,
  standing,
  isAuthed,
}: {
  season: Season;
  leader: LeaderboardRow | null;
  standing: SeasonStanding | null;
  isAuthed: boolean;
}) {
  const now = new Date();
  const left = daysLeft(season.endsAt, now);
  const ended = now >= season.endsAt;

  const target = season.targetPoints ?? null;
  const leaderPoints = leader?.points ?? 0;
  const pct = target ? Math.min(100, Math.round((leaderPoints / target) * 100)) : null;

  return (
    <div className="hud-panel-strong mb-8 overflow-hidden scanlines">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 tag-tactical text-primary">
            <HugeiconsIcon icon={ChampionIcon} className="h-3.5 w-3.5" />
            <span>// TEMPORADA {ended ? 'CERRANDO' : 'ACTIVA'}</span>
          </div>
          <h2 className="stencil text-3xl leading-none">{season.name}</h2>
          <p className="mt-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="text-foreground">Premio:</span>
            <span className="border border-accent px-2 py-0.5 text-accent">{season.prize}</span>
          </p>
        </div>

        <div className="text-right">
          <div className="display text-4xl leading-none text-accent">{left}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {ended ? 'cerrada' : left === 1 ? 'día restante' : 'días restantes'}
          </div>
        </div>
      </div>

      {target && (
        <div className="px-5 pb-4">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Líder hacia la meta</span>
            <span className="tabular-nums">
              {leaderPoints} / {target} pts
            </span>
          </div>
          <div className="h-2 w-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
          <HugeiconsIcon icon={FireIcon} className="h-4 w-4 text-accent" />
          {leader ? (
            <span className="text-muted-foreground">
              Líder: <span className="text-foreground">{leader.user.name}</span>{' '}
              <span className="tabular-nums text-danger">{leader.points} pts</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nadie puntuó todavía — subí tu clip</span>
          )}
        </div>

        {isAuthed && standing && (
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Vos:{' '}
            <span className="tabular-nums text-primary">{standing.points} pts</span>
            {standing.rank && <span className="tabular-nums"> · #{standing.rank}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
