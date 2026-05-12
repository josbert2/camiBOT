// Sistema de rangos militares basado en XP (puntos acumulados).
// Inspirado en progresión clásica CoD/Warzone.

export interface Rank {
  /** Nivel ordinal (1..N) */
  tier: number;
  /** Sigla corta (PVT, SGT, etc) — para tablas compactas */
  short: string;
  /** Nombre completo en ES */
  name: string;
  /** XP mínima para alcanzarlo */
  minXp: number;
  /** Color del rango: token semántico Tailwind */
  color: string;
  /** Acento visual del rango (clase Tailwind) */
  accent: string;
}

export const RANKS: Rank[] = [
  { tier: 1, short: 'RCT', name: 'Recluta', minXp: 0, color: 'text-muted-foreground', accent: 'border-muted' },
  { tier: 2, short: 'PVT', name: 'Soldado raso', minXp: 10, color: 'text-muted-foreground', accent: 'border-border' },
  { tier: 3, short: 'CPL', name: 'Cabo', minXp: 30, color: 'text-foreground', accent: 'border-border-strong' },
  { tier: 4, short: 'SGT', name: 'Sargento', minXp: 60, color: 'text-foreground', accent: 'border-border-strong' },
  { tier: 5, short: 'SSG', name: 'Sargento mayor', minXp: 100, color: 'text-success', accent: 'border-success' },
  { tier: 6, short: 'LT', name: 'Teniente', minXp: 160, color: 'text-success', accent: 'border-success' },
  { tier: 7, short: 'CPT', name: 'Capitán', minXp: 240, color: 'text-primary', accent: 'border-primary' },
  { tier: 8, short: 'MAJ', name: 'Mayor', minXp: 340, color: 'text-primary', accent: 'border-primary' },
  { tier: 9, short: 'COL', name: 'Coronel', minXp: 460, color: 'text-accent', accent: 'border-accent' },
  { tier: 10, short: 'GEN', name: 'General', minXp: 600, color: 'text-accent', accent: 'border-accent' },
  { tier: 11, short: 'CMD', name: 'Comandante', minXp: 800, color: 'text-danger', accent: 'border-danger' },
  { tier: 12, short: 'LGN', name: 'Leyenda', minXp: 1100, color: 'text-danger', accent: 'border-danger' },
];

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** XP necesaria para next */
  xpToNext: number;
  /** % de progreso al next (0-100) */
  progressPct: number;
}

export function getRankProgress(points: number): RankProgress {
  let current = RANKS[0]!;
  for (const r of RANKS) {
    if (points >= r.minXp) current = r;
    else break;
  }
  const nextIndex = RANKS.findIndex((r) => r.tier === current.tier) + 1;
  const next = nextIndex < RANKS.length ? RANKS[nextIndex]! : null;
  const xpToNext = next ? next.minXp - points : 0;
  const span = next ? next.minXp - current.minXp : 1;
  const earned = points - current.minXp;
  const progressPct = next ? Math.max(0, Math.min(100, (earned / span) * 100)) : 100;
  return { current, next, xpToNext, progressPct };
}
