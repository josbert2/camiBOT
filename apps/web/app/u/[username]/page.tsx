import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon, Comment01Icon, VideoReplayIcon, ChampionIcon } from '@hugeicons/core-free-icons';
import { getPublicProfile } from '@/lib/community';
import { getActiveSeason, getUserStanding } from '@/lib/season';

export const dynamic = 'force-dynamic';

const load = cache((username: string) => getPublicProfile(username));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await load(username);
  if (!profile) return { title: 'Operador no encontrado — Tournify' };
  const name = profile.author.name;
  return {
    title: `${name} — Tournify`,
    description: `${profile.postCount} clips · ${profile.likesReceived} likes en la comunidad.`,
    openGraph: {
      title: name,
      description: `${profile.postCount} clips · ${profile.likesReceived} likes`,
      images: profile.author.avatarUrl ? [{ url: profile.author.avatarUrl }] : undefined,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await load(username);
  if (!profile) notFound();

  const season = await getActiveSeason();
  const standing = season ? await getUserStanding(profile.userId, season) : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {profile.author.avatarUrl ? (
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
              {profile.author.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-1 tag-tactical">// OPERADOR</div>
          <h1 className="stencil truncate text-4xl">{profile.author.name}</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            @{profile.author.username}
          </p>
        </div>
      </header>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Stat icon={VideoReplayIcon} label="Clips" value={profile.postCount} />
        <Stat icon={FavouriteIcon} label="Likes recibidos" value={profile.likesReceived} />
        {season ? (
          <Stat
            icon={ChampionIcon}
            label={`Puntos · ${season.name}`}
            value={standing?.points ?? 0}
            sub={standing?.rank ? `Puesto #${standing.rank} de ${standing.ranked}` : 'Sin puntos aún'}
          />
        ) : (
          <Stat icon={ChampionIcon} label="Temporada" value={0} sub="Ninguna activa" />
        )}
      </div>

      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Clips
        </h2>
        {profile.clips.length === 0 ? (
          <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Todavía no subió ningún clip.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.clips.map((c) => (
              <Link
                key={c.id}
                href={c.slug ? `/c/${c.slug}` : `/c/${c.id}`}
                className="group hud-panel overflow-hidden transition hover:border-border-strong"
              >
                <div className="relative aspect-video bg-black">
                  {c.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <HugeiconsIcon icon={VideoReplayIcon} className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  {c.caption && <p className="truncate text-xs">{c.caption}</p>}
                  <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={FavouriteIcon} className="h-3 w-3" />
                      {c.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Comment01Icon} className="h-3 w-3" />
                      {c.comments}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
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
