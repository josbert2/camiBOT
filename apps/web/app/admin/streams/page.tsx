import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { discordAvatarUrl } from '@/lib/community';
import { StreamsAdmin, type StreamUser } from './streams-admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Streams — Admin' };

export default async function AdminStreamsPage() {
  const session = await auth();
  if (!isAdmin(session)) redirect('/');

  const users = await prisma.user.findMany({
    orderBy: [{ livePlatform: { sort: 'asc', nulls: 'last' } }, { username: 'asc' }],
    take: 1000,
    select: {
      id: true,
      username: true,
      globalName: true,
      nickname: true,
      discordId: true,
      avatar: true,
      twitchLogin: true,
      kickSlug: true,
      tiktokUser: true,
      livePlatform: true,
    },
  });

  const rows: StreamUser[] = users.map((u) => ({
    id: u.id,
    name: u.nickname ?? u.globalName ?? u.username,
    avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
    twitchLogin: u.twitchLogin,
    kickSlug: u.kickSlug,
    tiktokUser: u.tiktokUser,
    livePlatform: u.livePlatform,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <header className="mb-6 border-b border-border pb-4">
        <div className="mb-2 tag-tactical">// STREAMS · ADMIN</div>
        <h1 className="stencil text-4xl">Streams</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Cargá el usuario de Twitch / Kick / TikTok de cada uno. El bot chequea cada 2 min.
        </p>
      </header>
      <StreamsAdmin rows={rows} />
    </main>
  );
}
