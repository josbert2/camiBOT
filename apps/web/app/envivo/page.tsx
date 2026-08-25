import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { LiveStreaming02Icon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { discordAvatarUrl } from '@/lib/community';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'En vivo — Tournify',
  description: 'Miembros de la comunidad transmitiendo ahora.',
};

const LABEL: Record<string, string> = { twitch: 'Twitch', kick: 'Kick', tiktok: 'TikTok' };

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
      liveViewers: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {live.map((u) => {
            const name = u.nickname ?? u.globalName ?? u.username;
            const avatar = discordAvatarUrl(u.discordId, u.avatar);
            return (
              <li key={u.id}>
                <a
                  href={u.liveUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="hud-panel flex items-center gap-3 p-4 transition hover:border-border-strong"
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-muted text-sm text-muted-foreground">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold">{name}</span>
                      <span className="shrink-0 border border-danger/50 bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-danger">
                        ● {LABEL[u.livePlatform ?? ''] ?? 'Live'}
                      </span>
                    </div>
                    {u.liveTitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{u.liveTitle}</p>}
                    {u.liveViewers != null && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {u.liveViewers} viewers
                      </p>
                    )}
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
