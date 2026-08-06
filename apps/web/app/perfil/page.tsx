import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon, VideoReplayIcon, ChampionIcon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { getProfileSummary } from '@/lib/community';
import { publicUrl } from '@/lib/r2';
import { getActiveSeason, getUserStanding } from '@/lib/season';
import { MyClips, type MyClip } from './my-clips';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi perfil — Tournify',
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [profile, season, clips] = await Promise.all([
    getProfileSummary(session),
    getActiveSeason(),
    prisma.post.findMany({
      where: { authorId: userId, removedAt: null, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        caption: true,
        posterKey: true,
        weaponName: true,
        createdAt: true,
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);

  const standing = season ? await getUserStanding(userId, season) : null;

  const myClips: MyClip[] = clips.map((c) => ({
    id: c.id,
    caption: c.caption,
    posterUrl: c.posterKey ? publicUrl(c.posterKey) : null,
    likes: c._count.likes,
    comments: c._count.comments,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {profile?.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.author.avatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 border-2 border-border-strong object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center border-2 border-border-strong bg-muted">
            <span className="display text-xl text-muted-foreground">
              {(profile?.author.name ?? 'NA').slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-1 tag-tactical">// MI PERFIL</div>
          <h1 className="stencil truncate text-4xl">{profile?.author.name}</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            @{profile?.author.username}
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatBlock icon={VideoReplayIcon} label="Clips" value={profile?.postCount ?? 0} />
        <StatBlock icon={FavouriteIcon} label="Likes recibidos" value={profile?.likesReceived ?? 0} />
        {season ? (
          <StatBlock
            icon={ChampionIcon}
            label={`Puntos · ${season.name}`}
            value={standing?.points ?? 0}
            sub={standing?.rank ? `Puesto #${standing.rank} de ${standing.ranked}` : 'Sin puntos aún'}
          />
        ) : (
          <StatBlock icon={ChampionIcon} label="Temporada" value={0} sub="Ninguna activa" />
        )}
      </div>

      {season && (
        <div className="mb-10 border-l-2 border-accent bg-card px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
          Premio en juego: <span className="text-accent">{season.prize}</span> — sumás puntos
          por cada like que reciban tus clips.
        </div>
      )}

      {/* Mis clips */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Mis clips
        </h2>
        <MyClips clips={myClips} />
      </section>
    </main>
  );
}

function StatBlock({
  icon,
  label,
  value,
  sub,
}: {
  icon: typeof FavouriteIcon;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="stat-block">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <HugeiconsIcon icon={icon} className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 display text-4xl tabular-nums">{value}</div>
      {sub && <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{sub}</div>}
    </div>
  );
}
