import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { normalizeSlug } from '@/lib/community';
import { roundRobinPairs } from '@/lib/league';

/** Crea una liga round-robin con los jugadores elegidos (solo admin). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const userIds: string[] = Array.isArray(body?.userIds)
    ? ([...new Set(body.userIds.filter((x: unknown) => typeof x === 'string'))] as string[])
    : [];

  if (!name) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (userIds.length < 2) {
    return NextResponse.json({ error: 'Elegí al menos 2 jugadores.' }, { status: 400 });
  }

  const slug = normalizeSlug(name) ?? `liga-${Date.now()}`;

  try {
    const league = await prisma.$transaction(async (tx) => {
      const lg = await tx.league.create({
        data: { name, slug, status: 'ACTIVE', createdById: session.user!.id! },
        select: { id: true },
      });
      await tx.leaguePlayer.createMany({
        data: userIds.map((userId) => ({ leagueId: lg.id, userId })),
      });
      const players = await tx.leaguePlayer.findMany({
        where: { leagueId: lg.id },
        select: { id: true },
      });
      const pairs = roundRobinPairs(players.map((p) => p.id));
      if (pairs.length > 0) {
        await tx.leagueMatch.createMany({
          data: pairs.map(([homeId, awayId]) => ({ leagueId: lg.id, homeId, awayId })),
        });
      }
      return lg;
    });

    return NextResponse.json({ ok: true, id: league.id, slug }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una liga con ese nombre.' }, { status: 409 });
    }
    throw err;
  }
}
