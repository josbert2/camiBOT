'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WzCatalogItem } from './page';

const ORIGIN_LABEL: Record<string, string> = { bo7: 'BO7', bo6: 'BO6', mw3: 'MW3', mw2: 'MW2' };

export function WzCatalogFilters({
  items,
  tierColors,
}: {
  items: WzCatalogItem[];
  tierColors: Record<string, string>;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const origins = useMemo(
    () => [...new Set(items.map((i) => i.game))].filter(Boolean).sort(),
    [items],
  );

  const types = useMemo(() => {
    const pool = origin ? items.filter((i) => i.game === origin) : items;
    return [...new Set(pool.map((i) => i.type))].filter(Boolean).sort();
  }, [items, origin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (origin && i.game !== origin) return false;
      if (type && i.type !== type) return false;
      if (q && !i.id.toLowerCase().includes(q) && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, origin, type, search]);

  return (
    <>
      {/* Filtro origen */}
      {origins.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Origen</span>
          <FilterPill active={origin === null} onClick={() => setOrigin(null)}>
            Todos
          </FilterPill>
          {origins.map((o) => (
            <FilterPill key={o} active={origin === o} onClick={() => { setOrigin(o); setType(null); }}>
              {ORIGIN_LABEL[o] || o.toUpperCase()}
            </FilterPill>
          ))}
        </div>
      )}

      {/* Búsqueda + tipo */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar arma..."
          className="w-56 border-2 border-border bg-input px-3 py-2 text-sm focus:border-border-strong focus:outline-none"
        />
        <div className="flex flex-wrap gap-1">
          <FilterPill active={type === null} onClick={() => setType(null)}>
            Todos
          </FilterPill>
          {types.map((t) => (
            <FilterPill key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </FilterPill>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {items.length}
        </span>
      </div>

      {/* Lista */}
      <ul className="m-0 list-none space-y-1.5 p-0">
        {filtered.map((w) => (
          <li key={w.id}>
            <Link
              href={`/wz/${w.id}` as never}
              className="grid grid-cols-[110px_1fr_auto] items-center gap-4 border-2 border-border bg-card px-4 py-3 transition hover:border-border-strong"
            >
              <div className="flex h-16 items-center justify-center bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.imgThumb} alt={w.name} className="max-h-14 max-w-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display truncate text-xl uppercase">{w.name}</h2>
                  {w.game && (
                    <span className="border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {ORIGIN_LABEL[w.game] || w.game.toUpperCase()}
                    </span>
                  )}
                  {w.isNew && (
                    <span className="border border-accent/60 bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                      NEW
                    </span>
                  )}
                  <span className={`display border px-1.5 py-0.5 text-[11px] tracking-widest ${tierColors[w.tier] || tierColors.D}`}>
                    {w.tier === 'META' ? 'META' : `${w.tier} TIER`}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{w.typeLabel}</span>
                  {w.pickRate && (
                    <span className="border border-border bg-muted px-1.5 py-0 text-[10px]">
                      Pick rate {w.pickRate}
                    </span>
                  )}
                  {w.buildsCount > 0 && (
                    <span className="border border-border bg-muted px-1.5 py-0 text-[10px]">
                      {w.buildsCount} builds
                    </span>
                  )}
                  {w.badges.slice(0, 2).map((b, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 border px-1.5 py-0 text-[10px] font-bold uppercase ${
                        b.rank === 1
                          ? 'border-warning bg-warning text-background'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      <span className="display">#{b.rank}</span>
                      <span>{b.category}</span>
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Sin armas que matcheen con esos filtros.
        </p>
      )}
    </>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
        active
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
