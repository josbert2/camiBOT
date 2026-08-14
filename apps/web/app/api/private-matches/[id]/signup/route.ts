import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';

function cleanId(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null;
}

/**
 * El usuario logueado se apunta a una privada.
 *
 * Body (todo opcional):
 *   - gameId: identificador del juego (ej. Activision ID).
 *   - squadName: crea un equipo con ese nombre y quedás como capitán.
 *   - squadId: te unís a un equipo existente.
 * En privadas de solos (squadSize 1) no hace falta squad.
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
  const squadName = typeof body?.squadName === 'string' ? body.squadName.trim() : '';
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

  // Privada de solos: apuntarse directo.
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
  const myCaptainSquad = await prisma.privateSquad.findUnique({
    where: { matchId_captainId: { matchId: id, captainId: userId } },
  });

  // Crear equipo (quedo de capitán).
  if (squadName) {
    if (myCaptainSquad) return NextResponse.json({ error: 'Ya tenés un equipo en esta privada.' }, { status: 400 });
    if (squadName.length < 2) return NextResponse.json({ error: 'Nombre de equipo muy corto.' }, { status: 400 });
    if (!alreadyIn && cupoLleno) return NextResponse.json({ error: 'Cupo lleno.' }, { status: 400 });

    const squad = await prisma.privateSquad.create({
      data: { matchId: id, name: squadName.slice(0, 40), captainId: userId },
    });
    await prisma.privateMatchSignup.upsert({
      where: { matchId_userId: { matchId: id, userId } },
      update: { squadId: squad.id, gameId },
      create: { matchId: id, userId, squadId: squad.id, gameId },
    });
    return NextResponse.json({ ok: true });
  }

  // Unirse a un equipo existente.
  if (squadId) {
    if (myCaptainSquad && myCaptainSquad.id !== squadId) {
      return NextResponse.json({ error: 'Sos capitán de otro equipo. Salí primero.' }, { status: 400 });
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

    await prisma.privateMatchSignup.upsert({
      where: { matchId_userId: { matchId: id, userId } },
      update: { squadId, gameId },
      create: { matchId: id, userId, squadId, gameId },
    });
    return NextResponse.json({ ok: true });
  }

  // Sin squad elegido: si ya está apuntado, actualiza su gameId; si no, exige equipo.
  if (alreadyIn) {
    await prisma.privateMatchSignup.update({
      where: { matchId_userId: { matchId: id, userId } },
      data: { gameId },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Elegí un equipo o creá el tuyo.' }, { status: 400 });
}

/** El usuario logueado se baja de una privada (si es capitán, disuelve su equipo). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  // Si es capitán de un equipo acá, lo disuelve (los miembros quedan sin equipo).
  await prisma.privateSquad.deleteMany({ where: { matchId: id, captainId: userId } });
  await prisma.privateMatchSignup.deleteMany({ where: { matchId: id, userId } });

  return NextResponse.json({ ok: true });
}
