import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { LiveStreaming02Icon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { discordAvatarUrl } from '@/lib/community';
import { PlatformLogo, PLATFORM_META } from './platform-logo';

export const dynamic = 'force-dynamic';

// Color del degradado de fondo cuando no hay miniatura ni avatar.
const COVER_COLOR: Record<string, string> = { twitch: '#9146FF', kick: '#53FC18', tiktok: '#fe2c55' };

export const metadata: Metadata = {
  title: 'En vivo — Tournify',
  description: 'Miembros de la comunidad transmitiendo ahora.',
};

export default async function EnVivoPage() {
  const live = await prisma.user.findMany({
    where: { livePlatform: { not: null } },
    orderBy: [{ liveViewers: { sort: 'desc', nulls: 'last' } }, { liveStartedAt: 'asc' }],
    select: {
      id: true,
      username: true,
      globalName: true,
      nickname: true,
      discordId: true,
      avatar: true,
      livePlatform: true,
      liveTitle: true,
      liveUrl: true,
      liveThumb: true,
      liveViewers: true,
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <header className="mb-6 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical text-danger">
          <HugeiconsIcon icon={LiveStreaming02Icon} className="h-3.5 w-3.5" />
          <span>// EN VIVO AHORA</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">En vivo</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          {live.length ? `${live.length} transmitiendo ahora` : 'Nadie transmitiendo ahora mismo'}
        </p>
      </header>

      {live.length === 0 ? (
        <p className="hud-panel p-6 text-center text-sm text-muted-foreground">
          Cuando alguien arranque un stream, aparece acá.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {live.map((u) => {
            const name = u.nickname ?? u.globalName ?? u.username;
            const avatar = discordAvatarUrl(u.discordId, u.avatar);
            const thumb = u.liveThumb;
            const platform = u.livePlatform ?? '';
            const meta = PLATFORM_META[platform] ?? { label: 'Live', color: '#b91c1c' };
            return (
              <li key={u.id}>
                <a
                  href={u.liveUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-[3/4] overflow-hidden rounded-3xl border-2 border-border"
                >
                  {/* Portada / banner */}
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : avatar ? (
                    // Sin miniatura → usamos el avatar difuminado como banner.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl" />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(160deg, ${COVER_COLOR[platform] ?? meta.color}, #0a0c0d)` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />

                  {/* Logo de plataforma */}
                  <span
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
                    style={{ backgroundColor: meta.color }}
                    title={meta.label}
                  >
                    <PlatformLogo platform={platform} className="h-4 w-4" />
                  </span>

                  {/* EN VIVO */}
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> En vivo
                  </span>

                  {/* Contenido */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="flex items-center gap-2">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border-2 border-white/80 object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-black/40 text-[10px] font-bold text-white">
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <h2 className="stencil truncate text-2xl leading-none text-white">{name}</h2>
                    </div>
                    {u.liveTitle && <p className="mt-1 line-clamp-2 text-xs text-white/70">{u.liveTitle}</p>}
                    <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70">
                      <span>{meta.label}</span>
                      {u.liveViewers != null && (
                        <>
                          <span>·</span>
                          <span>{u.liveViewers} viewers</span>
                        </>
                      )}
                    </div>
                    <div className="mt-3 rounded-full bg-white py-2 text-center text-xs font-bold uppercase tracking-widest text-black transition group-hover:bg-white/90">
                      Ver stream
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
