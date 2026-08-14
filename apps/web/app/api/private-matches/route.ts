import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

/** Crea una privada (solo admin). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });

  const link = typeof body?.link === 'string' ? body.link.trim() || null : null;
  const prize = typeof body?.prize === 'string' ? body.prize.trim() || null : null;
  const hasSignup = body?.hasSignup !== false;

  let maxPlayers: number | null = null;
  if (typeof body?.maxPlayers === 'number' && Number.isFinite(body.maxPlayers)) {
    maxPlayers = Math.min(200, Math.max(2, Math.round(body.maxPlayers)));
  }

  let scheduledAt: Date | null = null;
  if (typeof body?.scheduledAt === 'string' && body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (!Number.isNaN(d.getTime())) scheduledAt = d;
  }

  const match = await prisma.privateMatch.create({
    data: { name, link, prize, hasSignup, maxPlayers, scheduledAt, createdById: session.user.id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: match.id }, { status: 201 });
}
