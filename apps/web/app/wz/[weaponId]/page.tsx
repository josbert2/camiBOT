import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getWeapon,
  listWeapons,
  isRecommendedBuild,
  extractAttachments,
  weaponImage,
  PLAYSTYLE_LABEL,
  TYPE_LABEL,
  GAME_LABEL,
  SLOT_LABEL,
  type WzWeapon,
  type WzBuild,
} from '@/lib/wz-data';

export const revalidate = 300; // 5 min — los dumps se actualizan via cron

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';

export async function generateStaticParams() {
  const weapons = listWeapons('warzone');
  return weapons.map((w) => ({ weaponId: w.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ weaponId: string }>;
}): Promise<Metadata> {
  const { weaponId } = await params;
  const w = getWeapon(weaponId, 'warzone');
  if (!w) return { title: 'Arma no encontrada' };

  const top = (w.builds || []).find(isRecommendedBuild) ?? w.builds?.[0];
  const topAtts = top ? extractAttachments(top).map((a) => a.name).filter(Boolean).slice(0, 3) : [];
  const badges = (w.badges || []).map((b) => `#${b.rank} ${b.category}`).join(' · ');
  const typeLabel = (w.displayTypeLabel || (w.type ? TYPE_LABEL[w.type] : '') || '') as string;
  const gameLabel: string = (w.game ? GAME_LABEL[w.game] : 'Warzone') ?? 'Warzone';

  const title = `${w.name} · Mejor build Warzone ${new Date().getFullYear()}`;
  const description = [
    `Build recomendado de ${w.name} (${typeLabel}, ${gameLabel}) para Warzone.`,
    badges ? `Posiciones: ${badges}.` : null,
    w.tier ? `Tier ${w.tier}.` : null,
    w.pickRate ? `Pick rate ${w.pickRate}.` : null,
    topAtts.length ? `Accesorios: ${topAtts.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const img = weaponImage(w, 'thumb');

  return {
    title,
    description,
    alternates: { canonical: `/wz/${w.id}` },
    keywords: [
      w.name,
      `${w.name} build`,
      `${w.name} loadout`,
      `mejor ${w.name}`,
      `${w.name} warzone`,
      `${w.name} ${gameLabel.toLowerCase()}`,
      typeLabel,
      'warzone meta',
      'mejor arma warzone',
      'loadout warzone',
      'wz meta',
    ],
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/wz/${w.id}`,
      title,
      description,
      images: [{ url: img, width: 320, height: 180, alt: w.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [img],
    },
  };
}

const TIER_COLOR: Record<string, string> = {
  META: 'bg-warning/20 text-warning border-warning/40',
  A: 'bg-border-strong/15 text-border-strong border-border-strong/40',
  B: 'bg-primary/15 text-primary border-primary/40',
  C: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/40',
  D: 'bg-danger/15 text-danger border-danger/40',
};

function PlaystyleCard({
  build,
  weapon,
  isRecommended,
}: {
  build: WzBuild;
  weapon: WzWeapon;
  isRecommended: boolean;
}) {
  const playstyleLabel = isRecommended ? 'Recomendado' : PLAYSTYLE_LABEL[build.playstyle || ''] || build.playstyle || 'Build';
  const atts = extractAttachments(build);
  const attsDetail = weapon.details?.attachments || [];

  return (
    <article className="border-2 border-border bg-card p-5">
      <div className={`mb-4 flex items-center gap-2 border-b-2 pb-3 ${isRecommended ? 'border-warning text-warning' : 'border-primary text-primary'}`}>
        {isRecommended && <span aria-hidden>👑</span>}
        <h3 className="display text-lg tracking-widest">{playstyleLabel}</h3>
      </div>
      <ol className="m-0 list-none space-y-2 p-0">
        {atts.map((a, i) => {
          const detail = attsDetail.find(
            (d) => d.attachmentId?.toLowerCase() === a.attachmentId?.toLowerCase() ||
              d.attachmentId?.toLowerCase().endsWith((a.attachmentId || '').toLowerCase()),
          );
          const slotLabel = SLOT_LABEL[a.slot || ''] || a.slot || '';
          const lvl = detail?.unlockLevel;
          const isBP = detail?.unlockedByBattlePass || (detail?.lockedByDefault && !detail?.isPrestigeAttachment && !detail?.isConversionKitAttachment);
          const isPrestige = detail?.isPrestigeAttachment;
          const isConv = detail?.isConversionKitAttachment;
          return (
            <li key={i} className="border-b border-border/40 pb-2 last:border-0">
              <div className="text-[11px] font-bold uppercase leading-tight text-foreground">
                {a.name || '—'}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase text-accent">
                  {slotLabel}
                </span>
                {isPrestige ? (
                  <span className="border border-purple-400/40 bg-purple-400/15 px-1.5 py-0.5 text-[10px] uppercase text-purple-400">
                    Prestigio
                  </span>
                ) : isBP ? (
                  <span className="border border-warning/40 bg-warning/15 px-1.5 py-0.5 text-[10px] uppercase text-warning">
                    Pase de Batalla
                  </span>
                ) : isConv ? (
                  <span className="border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase text-accent">
                    Kit conversión
                  </span>
                ) : lvl ? (
                  <span className="border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    Nivel {lvl}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export default async function WeaponPage({ params }: { params: Promise<{ weaponId: string }> }) {
  const { weaponId } = await params;
  const w = getWeapon(weaponId, 'warzone');
  if (!w) notFound();

  const builds = (w.builds || []).slice();
  const recommended = builds.find(isRecommendedBuild);
  const order = ['LONG_RANGE', 'SHORT_RANGE', 'LOW_RECOIL', 'HIGH_BULLET_VELOCITY', 'HIP_FIRE', 'TAC_STANCE', 'CONVERSION_KIT', 'MOBILITY', 'ADS_SPEED', 'SNIPER_SUPPORT', 'AKIMBO', 'SUPPRESSED', 'RESURGENCE', 'BATTLE_ROYALE', 'VERSATILE', 'PRESTIGE', 'RANKED', 'EIGHT_ATTACHMENTS', 'FIVE_ATTACHMENTS', 'LOW_LEVEL'];
  const rest = builds.filter((b) => b !== recommended).sort((a, b) => {
    const ia = order.indexOf(a.playstyle || '');
    const ib = order.indexOf(b.playstyle || '');
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const ordered = recommended ? [recommended, ...rest] : rest;

  const typeLabel = (w.displayTypeLabel || (w.type ? TYPE_LABEL[w.type] : '') || '') as string;
  const gameLabel: string = (w.game ? GAME_LABEL[w.game] : 'Warzone') ?? 'Warzone';
  const tier = w.tier || 'D';
  const img = weaponImage(w, 'thumb');
  const imgFull = weaponImage(w, 'full');

  const prosFromBuild = recommended && Array.isArray(recommended.pros) ? recommended.pros : [];
  const consFromBuild = recommended && Array.isArray(recommended.cons) ? recommended.cons : [];
  const detailProsCons = w.details?.prosCons;
  const pros = (detailProsCons?.pros?.map((p) => p.name) ?? prosFromBuild) as string[];
  const cons = (detailProsCons?.cons?.map((p) => p.name) ?? consFromBuild) as string[];

  // JSON-LD Product schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: `${w.name} (${gameLabel})`,
        image: imgFull,
        description: `Build recomendado de ${w.name} para Warzone.${w.tier ? ` Tier ${w.tier}.` : ''}${w.pickRate ? ` Pick rate ${w.pickRate}.` : ''}`,
        url: `${SITE_URL}/wz/${w.id}`,
        category: typeLabel || 'Weapon',
        brand: { '@type': 'Brand', name: 'Call of Duty' },
        ...(w.pickRate ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: w.tier === 'META' ? '5' : w.tier === 'A' ? '4.5' : w.tier === 'B' ? '4' : w.tier === 'C' ? '3' : '2',
            bestRating: '5',
            ratingCount: '1000',
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tournify', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'WZ Meta', item: `${SITE_URL}/wz` },
          { '@type': 'ListItem', position: 3, name: w.name, item: `${SITE_URL}/wz/${w.id}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          <Link href="/wz" className="hover:text-foreground">WZ Meta</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{w.name}</span>
        </nav>

        <header className="mb-6 grid gap-6 border-b-2 border-border pb-6 md:grid-cols-[200px_1fr]">
          <div className="flex h-32 items-center justify-center bg-card md:h-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={w.name} className="max-h-28 max-w-full object-contain md:max-h-36" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {w.game && (
                <span className="border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {w.game.toUpperCase()}
                </span>
              )}
              {w.isNew && (
                <span className="border border-accent/60 bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                  NEW
                </span>
              )}
              <span className={`display border px-2 py-0.5 text-xs tracking-widest ${TIER_COLOR[tier] || TIER_COLOR.D}`}>
                {tier === 'META' ? 'META' : `${tier} TIER`}
              </span>
            </div>
            <h1 className="display mt-2 text-5xl uppercase">{w.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {typeLabel} · {gameLabel}
              {w.pickRate ? ` · Pick rate ${w.pickRate}` : ''}
            </p>
            {w.badges && w.badges.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {w.badges.map((b, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-1 border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      b.rank === 1
                        ? 'border-warning bg-warning text-background'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="display">#{b.rank}</span>
                    <span>{b.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        {(pros.length > 0 || cons.length > 0) && (
          <section className="mb-6 grid gap-4 md:grid-cols-2">
            {pros.length > 0 && (
              <div className="border-2 border-success/40 bg-card p-4">
                <h2 className="display mb-2 text-sm tracking-widest text-success">Pros</h2>
                <ul className="m-0 list-none space-y-1 p-0 text-sm">
                  {pros.slice(0, 8).map((p, i) => <li key={i}>+ {p}</li>)}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="border-2 border-danger/40 bg-card p-4">
                <h2 className="display mb-2 text-sm tracking-widest text-danger">Contras</h2>
                <ul className="m-0 list-none space-y-1 p-0 text-sm">
                  {cons.slice(0, 8).map((p, i) => <li key={i}>− {p}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="display mb-3 text-2xl uppercase tracking-widest">
            Builds · <span className="text-muted-foreground text-base">{ordered.length} variantes</span>
          </h2>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin builds curados para esta arma.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ordered.map((b) => (
                <PlaystyleCard
                  key={b.id}
                  build={b}
                  weapon={w}
                  isRecommended={b === recommended}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t-2 border-border pt-4 text-xs text-muted-foreground">
          Datos extraídos de wzstats.gg. Actualizado diariamente vía scraper.
          {' '}
          <Link href="/wz" className="text-accent hover:underline">← Volver al catálogo</Link>
        </footer>
      </main>
    </>
  );
}
