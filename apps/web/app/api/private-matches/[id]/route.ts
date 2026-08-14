import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

const STATUSES = ['OPEN', 'CLOSED', 'FINISHED'] as const;
type Status = (typeof STATUSES)[number];

/** Cambia el estado de una privada (solo admin). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const data: { status?: Status; hasSignup?: boolean } = {};
  if (body?.status !== undefined) {
    const status = body.status as Status;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    data.status = status;
  }
  if (typeof body?.hasSignup === 'boolean') {
    data.hasSignup = body.hasSignup;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });
  }

  await prisma.privateMatch.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

/** Borra una privada (solo admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.privateMatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
