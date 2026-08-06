import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon, Comment01Icon, GunIcon } from '@hugeicons/core-free-icons';
import { prisma } from '@camibot/db';
import { publicUrl } from '@/lib/r2';
import { discordAvatarUrl, getComments } from '@/lib/community';
import { VideoPlayer } from '../../comunidad/video-player';

export const dynamic = 'force-dynamic';

/** Post público para compartir. Cacheado por request (metadata + page). */
const getSharePost = cache(async (id: string) => {
  const post = await prisma.post.findFirst({
    where: { removedAt: null, status: 'PUBLISHED', OR: [{ id }, { slug: id }] },
    select: {
      id: true,
      caption: true,
      videoKey: true,
      posterKey: true,
      width: true,
      height: true,
      weaponName: true,
      gameMode: true,
      createdAt: true,
      author: { select: { discordId: true, username: true, globalName: true, avatar: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  return post;
});

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

function videoMime(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_MIME[ext] ?? 'video/mp4';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getSharePost(id);
  if (!post) return { title: 'Clip no encontrado — Tournify' };

  const author = post.author.globalName ?? post.author.username;
  const title = post.caption?.trim() || `Play de ${author}`;
  const description = post.caption?.trim()
    ? `${author} en la comunidad de Tournify`
    : `Mirá la jugada de ${author} en la comunidad de Tournify.`;
  const poster = post.posterKey ? publicUrl(post.posterKey) : undefined;
  const video = publicUrl(post.videoKey);

  return {
    title: `${title} — Tournify`,
    description,
    openGraph: {
      title,
      description,
      type: 'video.other',
      images: poster ? [{ url: poster }] : undefined,
      videos: [
        {
          url: video,
          type: videoMime(post.videoKey),
          width: post.width ?? undefined,
          height: post.height ?? undefined,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: poster ? [poster] : undefined,
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getSharePost(id);
  if (!post) notFound();

  const author = post.author.globalName ?? post.author.username;
  const avatar = discordAvatarUrl(post.author.discordId, post.author.avatar);
  const comments = await getComments(null, post.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <article className="hud-panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 border-2 border-border object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-muted">
              <span className="display text-sm text-muted-foreground">
                {author.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base tracking-wide">{author}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Comunidad Tournify
            </p>
          </div>
        </header>

        {post.caption && <p className="px-4 pt-3 text-sm leading-relaxed">{post.caption}</p>}

        {(post.weaponName || post.gameMode) && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {post.weaponName && (
              <span className="flex items-center gap-1.5 border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-primary">
                <HugeiconsIcon icon={GunIcon} className="h-3 w-3" />
                {post.weaponName}
              </span>
            )}
            {post.gameMode && (
              <span className="border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {post.gameMode}
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <VideoPlayer
            src={publicUrl(post.videoKey)}
            poster={post.posterKey ? publicUrl(post.posterKey) : undefined}
            autoPlay
          />
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5 text-danger">
            <HugeiconsIcon icon={FavouriteIcon} className="h-4 w-4" />
            {post._count.likes}
          </span>
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={Comment01Icon} className="h-4 w-4" />
            {post._count.comments}
          </span>
          <Link
            href="/comunidad"
            className="ml-auto text-primary transition hover:text-foreground"
          >
            Ver más en la comunidad →
          </Link>
        </div>

        {/* Comentarios (lectura) */}
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 tag-tactical">
            // COMENTARIOS ({comments.length})
          </div>
          {comments.length === 0 ? (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Sin comentarios todavía
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  {c.author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.author.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted">
                      <span className="display text-[10px] text-muted-foreground">
                        {c.author.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="display text-sm tracking-wide">{c.author.name}</span>
                    <p className="mt-0.5 break-words text-sm text-foreground/90">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/comunidad"
            className="mt-4 inline-block text-xs uppercase tracking-widest text-primary hover:text-foreground"
          >
            Comentá y reaccioná en la comunidad →
          </Link>
        </div>
      </article>
    </main>
  );
}
