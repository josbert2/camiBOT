import type { Metadata } from 'next';
import Link from 'next/link';
import {
  listWeapons,
  isRecommendedBuild,
  weaponImage,
  TYPE_LABEL,
  GAME_LABEL,
  type WzWeapon,
} from '@/lib/wz-data';
import { WzCatalogFilters } from './filters';

export const revalidate = 300;

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';

export const metadata: Metadata = {
  title: `WZ Meta · Mejor build de cada arma — Warzone ${new Date().getFullYear()}`,
  description:
    'Catálogo completo de armas de Warzone con builds recomendados, tier list, pick rate y rankings por categoría. Datos actualizados a diario desde wzstats.gg.',
  alternates: { canonical: '/wz' },
  keywords: [
    'warzone meta',
    'mejor arma warzone',
    'mejores loadouts warzone',
    'tier list warzone',
    'wz meta',
    'warzone builds',
    'mejor loadout',
    'meta call of duty',
    'cod meta',
    'mejor build warzone',
  ],
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/wz`,
    title: `WZ Meta · Catálogo de armas Warzone`,
    description: 'Builds recomendados, tier list y rankings. Actualizado a diario.',
  },
};

const TIER_BG: Record<string, string> = {
  META: 'bg-warning/20 text-warning border-warning/40',
  A: 'bg-border-strong/15 text-border-strong border-border-strong/40',
  B: 'bg-primary/15 text-primary border-primary/40',
  C: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/40',
  D: 'bg-danger/15 text-danger border-danger/40',
};

export type WzCatalogItem = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  game: string;
  gameLabel: string;
  tier: string;
  isNew: boolean;
  position: number;
  pickRate: string | null;
  badges: { rank: number; category: string }[];
  buildsCount: number;
  imgThumb: string;
  recommendedPlaystyle: string | null;
};

function toCatalogItem(w: WzWeapon): WzCatalogItem {
  const recommended = (w.builds || []).find(isRecommendedBuild);
  return {
    id: w.id,
    name: w.name,
    type: w.type || '',
    typeLabel: (w.displayTypeLabel || (w.type ? TYPE_LABEL[w.type] : '') || '') as string,
    game: w.game || '',
    gameLabel: ((w.game ? GAME_LABEL[w.game] : '') ?? '') as string,
    tier: w.tier || 'D',
    isNew: !!w.isNew,
    position: w.position ?? 9999,
    pickRate: w.pickRate ?? null,
    badges: (w.badges || []).map((b) => ({ rank: b.rank, category: b.category })),
    buildsCount: (w.builds || []).length,
    imgThumb: weaponImage(w, 'thumb'),
    recommendedPlaystyle: recommended?.playstyle ?? null,
  };
}

export default async function WzCatalogPage() {
  const weapons = listWeapons('warzone')
    .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
    .map(toCatalogItem);

  // JSON-LD ItemList para SEO de catálogos
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catálogo de armas Warzone',
    numberOfItems: weapons.length,
    itemListElement: weapons.slice(0, 50).map((w, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: w.name,
      url: `${SITE_URL}/wz/${w.id}`,
      image: w.imgThumb,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 border-b-2 border-border pb-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                Catálogo Warzone
              </div>
              <h1 className="display mt-1 text-5xl uppercase">WZ Meta</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {weapons.length} armas con builds recomendados, tier list y rankings.
                Datos actualizados a diario desde wzstats.gg.
              </p>
            </div>
          </div>
        </header>

        <WzCatalogFilters items={weapons} tierColors={TIER_BG} />
      </main>
    </>
  );
}
