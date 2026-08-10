import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

/** Cambia el estado de la liga (ACTIVE/FINISHED). Solo admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'ACTIVE' && status !== 'FINISHED') {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  }

  const found = await prisma.league.findUnique({ where: { id }, select: { id: true } });
  if (!found) return NextResponse.json({ error: 'Liga inexistente.' }, { status: 404 });

  await prisma.league.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true, status });
}
