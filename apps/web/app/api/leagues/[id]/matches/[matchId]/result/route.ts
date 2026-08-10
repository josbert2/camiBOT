import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null;
}

/** Carga (o corrige) el resultado de un partido de liga. Admin o los jugadores. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id: leagueId, matchId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const match = await prisma.leagueMatch.findFirst({
    where: { id: matchId, leagueId },
    select: { id: true, home: { select: { userId: true } }, away: { select: { userId: true } } },
  });
  if (!match) return NextResponse.json({ error: 'Partido inexistente.' }, { status: 404 });

  const uid = session.user.id;
  const isPlayer = match.home.userId === uid || match.away.userId === uid;
  if (!isAdmin(session) && !isPlayer) {
    return NextResponse.json({ error: 'No podés cargar este partido.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const homeScore = intOrNull(body?.homeScore);
  const awayScore = intOrNull(body?.awayScore);
  if (homeScore == null || awayScore == null) {
    return NextResponse.json({ error: 'Cargá los goles de ambos.' }, { status: 400 });
  }
  const homeKills = intOrNull(body?.homeKills) ?? 0;
  const awayKills = intOrNull(body?.awayKills) ?? 0;

  await prisma.leagueMatch.update({
    where: { id: matchId },
    data: { homeScore, awayScore, homeKills, awayKills, status: 'PLAYED', playedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
