import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';

function cleanId(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null;
}

/** Si el capitán del squad se va, promueve al siguiente miembro (o lo deja vacío). */
async function reassignCaptain(squadId: string, leavingUserId: string) {
  const squad = await prisma.privateSquad.findUnique({ where: { id: squadId }, select: { captainId: true } });
  if (!squad || squad.captainId !== leavingUserId) return;
  const next = await prisma.privateMatchSignup.findFirst({
    where: { squadId, userId: { not: leavingUserId } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  await prisma.privateSquad.update({ where: { id: squadId }, data: { captainId: next?.userId ?? null } });
}

/**
 * El usuario logueado se apunta / se une a un equipo.
 * Body: { gameId?, squadId? }. En equipos, squadId es el slot elegido (cualquiera
 * con lugar). El primero que entra a un slot vacío queda de capitán.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Iniciá sesión para apuntarte.' }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const gameId = cleanId(body?.gameId);
  const squadId = typeof body?.squadId === 'string' && body.squadId ? body.squadId : null;

  const match = await prisma.privateMatch.findUnique({
    where: { id },
    include: { _count: { select: { signups: true } } },
  });
  if (!match) return NextResponse.json({ error: 'Privada no encontrada.' }, { status: 404 });
  if (!match.hasSignup) return NextResponse.json({ error: 'Esta privada no tiene inscripción.' }, { status: 400 });
  if (match.status !== 'OPEN') return NextResponse.json({ error: 'La inscripción está cerrada.' }, { status: 400 });

  const existing = await prisma.privateMatchSignup.findUnique({
    where: { matchId_userId: { matchId: id, userId } },
  });
  const alreadyIn = existing != null;
  const cupoLleno = match.maxPlayers != null && match._count.signups >= match.maxPlayers;

  // Privada de solos.
  if (match.squadSize <= 1) {
    if (!alreadyIn && cupoLleno) return NextResponse.json({ error: 'Cupo lleno.' }, { status: 400 });
    await prisma.privateMatchSignup.upsert({
      where: { matchId_userId: { matchId: id, userId } },
      update: { gameId },
      create: { matchId: id, userId, gameId },
    });
    return NextResponse.json({ ok: true });
  }

  // --- Modo equipos ---
  if (!squadId) {
    if (alreadyIn) {
      await prisma.privateMatchSignup.update({
        where: { matchId_userId: { matchId: id, userId } },
        data: { gameId },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Elegí un equipo.' }, { status: 400 });
  }

  const squad = await prisma.privateSquad.findFirst({
    where: { id: squadId, matchId: id },
    include: { _count: { select: { members: true } } },
  });
  if (!squad) return NextResponse.json({ error: 'Equipo no encontrado.' }, { status: 404 });

  const alreadyInThis = existing?.squadId === squadId;
  if (!alreadyInThis && squad._count.members >= match.squadSize) {
    return NextResponse.json({ error: 'Ese equipo está completo.' }, { status: 400 });
  }
  if (!alreadyIn && cupoLleno) return NextResponse.json({ error: 'Cupo lleno.' }, { status: 400 });

  // Si venía de otro equipo, libero la capitanía anterior antes de moverme.
  if (existing?.squadId && existing.squadId !== squadId) {
    await reassignCaptain(existing.squadId, userId);
  }

  await prisma.privateMatchSignup.upsert({
    where: { matchId_userId: { matchId: id, userId } },
    update: { squadId, gameId },
    create: { matchId: id, userId, squadId, gameId },
  });

  // Primero en entrar al slot → queda de capitán.
  if (squad.captainId == null) {
    await prisma.privateSquad.update({ where: { id: squadId }, data: { captainId: userId } });
  }

  return NextResponse.json({ ok: true });
}

/** El usuario logueado se baja de la privada (si era capitán, promueve al siguiente). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const mine = await prisma.privateMatchSignup.findUnique({
    where: { matchId_userId: { matchId: id, userId } },
    select: { squadId: true },
  });
  await prisma.privateMatchSignup.deleteMany({ where: { matchId: id, userId } });
  if (mine?.squadId) await reassignCaptain(mine.squadId, userId);

  return NextResponse.json({ ok: true });
}
