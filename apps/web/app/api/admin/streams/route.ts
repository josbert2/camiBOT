import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/^@+/, '').slice(0, 80);
  return t || null;
}

/** Setea los handles de streaming de un usuario (solo admin). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  if (!userId) return NextResponse.json({ error: 'Falta userId.' }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: {
      twitchLogin: clean(body?.twitchLogin),
      kickSlug: clean(body?.kickSlug),
      tiktokUser: clean(body?.tiktokUser),
    },
  });

  return NextResponse.json({ ok: true });
}
