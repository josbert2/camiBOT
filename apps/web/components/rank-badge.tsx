import { HugeiconsIcon } from '@hugeicons/react';
import {
  Shield01Icon,
  Medal01Icon,
  ChampionIcon,
  StarIcon,
  TargetIcon,
} from '@hugeicons/core-free-icons';
import { getRankProgress, type Rank } from '@/lib/ranks';

function iconFor(tier: number) {
  if (tier >= 11) return ChampionIcon;
  if (tier >= 9) return StarIcon;
  if (tier >= 7) return Medal01Icon;
  if (tier >= 4) return Shield01Icon;
  return TargetIcon;
}

export function RankBadge({
  points,
  size = 'md',
  withProgress = false,
}: {
  points: number;
  size?: 'sm' | 'md' | 'lg';
  withProgress?: boolean;
}) {
  const { current, next, xpToNext, progressPct } = getRankProgress(points);
  const Icon = iconFor(current.tier);

  const sizes = {
    sm: { wrap: 'gap-1.5 px-2 py-1', icon: 'h-3.5 w-3.5', label: 'text-[10px]', sub: 'text-[9px]' },
    md: { wrap: 'gap-2 px-3 py-1.5', icon: 'h-4 w-4', label: 'text-xs', sub: 'text-[10px]' },
    lg: { wrap: 'gap-3 px-4 py-2', icon: 'h-6 w-6', label: 'text-sm', sub: 'text-xs' },
  }[size];

  return (
    <div className={`inline-flex items-center ${sizes.wrap} border ${current.accent} bg-card`}>
      <HugeiconsIcon icon={Icon} className={`${sizes.icon} ${current.color}`} />
      <div className="flex flex-col leading-none">
        <span className={`display tracking-widest ${sizes.label} ${current.color}`}>
          {current.short} · {current.name}
        </span>
        {withProgress && next && (
          <div className="mt-1 flex w-full min-w-[120px] flex-col gap-0.5">
            <div className="h-0.5 w-full bg-border">
              <div
                className={`h-full ${current.color.replace('text-', 'bg-')}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={`tabular-nums text-muted-foreground ${sizes.sub}`}>
              {xpToNext} XP → {next.short}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RankShort({ points }: { points: number }) {
  const { current } = getRankProgress(points);
  return (
    <span className={`display tracking-widest ${current.color}`}>{current.short}</span>
  );
}

export { type Rank };
