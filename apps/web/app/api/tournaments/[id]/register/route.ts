import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@camibot/db';
import { auth } from '@/auth';

/** Registro/baja a un torneo desde la web (mientras el registro está abierto). */

async function loadTournament(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      maxParticipants: true,
      teamSize: true,
      registrationClosesAt: true,
      _count: { select: { participants: true } },
    },
  });
}

function registrationOpen(t: { status: string; registrationClosesAt: Date | null }): boolean {
  if (t.status !== 'REGISTRATION') return false;
  if (t.registrationClosesAt && new Date() > t.registrationClosesAt) return false;
  return true;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const t = await loadTournament(id);
  if (!t) return NextResponse.json({ error: 'Torneo inexistente.' }, { status: 404 });
  if (!registrationOpen(t)) {
    return NextResponse.json({ error: 'El registro está cerrado.' }, { status: 409 });
  }
  if (t._count.participants >= t.maxParticipants) {
    return NextResponse.json({ error: 'No quedan cupos.' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const teamName =
    t.teamSize > 1 && typeof body?.teamName === 'string'
      ? body.teamName.trim().slice(0, 60) || null
      : null;

  try {
    await prisma.participant.create({
      data: { tournamentId: id, userId: session.user.id, teamName, status: 'REGISTERED' },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya estás registrado.' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, registered: true }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const t = await loadTournament(id);
  if (!t) return NextResponse.json({ error: 'Torneo inexistente.' }, { status: 404 });
  // Solo se puede salir mientras el registro sigue abierto (antes de armar el bracket).
  if (t.status !== 'REGISTRATION') {
    return NextResponse.json({ error: 'Ya no podés salir: el torneo arrancó.' }, { status: 409 });
  }

  await prisma.participant.deleteMany({
    where: { tournamentId: id, userId: session.user.id, status: 'REGISTERED' },
  });

  return NextResponse.json({ ok: true, registered: false });
}
