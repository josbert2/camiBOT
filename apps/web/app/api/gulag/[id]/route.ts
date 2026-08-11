import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

const STATUSES = ['ACCUSED', 'CONFIRMED', 'ACQUITTED'] as const;
type Status = (typeof STATUSES)[number];

/** Cambia el veredicto de un acusado (solo admin). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status as Status | undefined;
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Veredicto inválido.' }, { status: 400 });
  }

  await prisma.gulagEntry.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}

/** Saca a alguien del gulag borrando la acusación (solo admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.gulagEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
