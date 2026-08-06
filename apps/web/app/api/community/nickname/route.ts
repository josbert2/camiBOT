import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@camibot/db';
import { auth } from '@/auth';
import { containsProfanity } from '@/lib/profanity';

/**
 * Setea el apodo del usuario (o marca que eligió usar el de Discord con
 * skip:true). En ambos casos deja nicknameSet=true para no volver a preguntar.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  if (body?.skip) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nickname: null, nicknameSet: true },
    });
    return NextResponse.json({ ok: true, nickname: null });
  }

  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().replace(/\s+/g, ' ') : '';

  if (nickname.length < 2 || nickname.length > 24) {
    return NextResponse.json(
      { error: 'El apodo tiene que tener entre 2 y 24 caracteres.' },
      { status: 400 },
    );
  }
  if (containsProfanity(nickname)) {
    return NextResponse.json({ error: 'Ese apodo no está permitido.' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nickname, nicknameSet: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ese apodo ya está en uso.' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, nickname });
}
