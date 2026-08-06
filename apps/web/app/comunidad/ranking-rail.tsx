import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { RankingIcon, FavouriteIcon, VideoReplayIcon } from '@hugeicons/core-free-icons';
import type { LeaderboardRow } from '@/lib/season';

/**
 * Ranking del sidebar derecho: players con mas likes y clips. Alimentado por
 * la temporada activa, o all-time si no hay ninguna.
 */
export function RankingRail({
  rows,
  seasonName,
}: {
  rows: LeaderboardRow[];
  seasonName?: string;
}) {
  return (
    <div className="hud-panel p-4">
      <div className="mb-1 flex items-center gap-2 tag-tactical">
        <HugeiconsIcon icon={RankingIcon} className="h-3.5 w-3.5" />
        <span>// RANKING</span>
      </div>
      <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        {seasonName ?? 'Histórico'}
      </p>

      {rows.length === 0 ? (
        <p className="py-4 text-xs uppercase tracking-widest text-muted-foreground">
          Todavía sin puntos
        </p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <li key={r.user.id}>
              <Link
                href={`/u/${r.user.username}`}
                className="flex items-center gap-3 border-l-2 border-transparent px-1 py-1.5 transition hover:border-primary hover:bg-card"
              >
              <span
                className={`display w-5 shrink-0 text-center text-base leading-none ${
                  r.rank === 1
                    ? 'text-accent'
                    : r.rank <= 3
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}
              >
                {r.rank}
              </span>

              {r.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 border border-border object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted">
                  <span className="display text-[10px] text-muted-foreground">
                    {r.user.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              <span className="min-w-0 flex-1 truncate text-xs" title={r.user.name}>
                {r.user.name}
              </span>

              <span className="flex shrink-0 items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                <span className="flex items-center gap-0.5 text-danger">
                  <HugeiconsIcon icon={FavouriteIcon} className="h-3 w-3" />
                  {r.points}
                </span>
                <span className="flex items-center gap-0.5">
                  <HugeiconsIcon icon={VideoReplayIcon} className="h-3 w-3" />
                  {r.clips}
                </span>
              </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
