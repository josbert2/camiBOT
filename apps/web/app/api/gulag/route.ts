import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

/**
 * Manda a alguien al gulag (solo admin).
 *
 * Se puede acusar a un usuario registrado (`userId`) o a alguien que solo
 * existe en Discord, pasando el `name` a mano.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' && body.userId ? body.userId : null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() || null : null;
  const evidence = typeof body?.evidence === 'string' ? body.evidence.trim() || null : null;
  let name = typeof body?.name === 'string' ? body.name.trim() : '';

  // Si viene enlazado a un usuario, el nombre sale de la cuenta.
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, globalName: true, nickname: true },
    });
    if (!user) return NextResponse.json({ error: 'Ese usuario no existe.' }, { status: 404 });
    name = user.nickname ?? user.globalName ?? user.username;
  }

  if (!name) return NextResponse.json({ error: 'Falta el nombre del acusado.' }, { status: 400 });

  const entry = await prisma.gulagEntry.create({
    data: { name, userId, reason, evidence, createdById: session.user.id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
}
