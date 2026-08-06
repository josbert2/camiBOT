import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@camibot/db';
import { auth } from '@/auth';
import { discordAvatarUrl } from '@/lib/community';

/** Busca usuarios para autocompletar @menciones en los comentarios. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ users: [] });
  }

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { globalName: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, discordId: true, username: true, globalName: true, avatar: true },
    take: 8,
    orderBy: { username: 'asc' },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.globalName ?? u.username,
      avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
    })),
  });
}
