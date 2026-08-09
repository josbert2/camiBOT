import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';

/** Voto del tribunal: culpable/inocente. Re-votar cambia; votar lo mismo lo saca. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const vote = body?.vote;
  if (vote !== 'GUILTY' && vote !== 'INNOCENT') {
    return NextResponse.json({ error: 'Voto inválido.' }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, kind: true },
  });
  if (!post || post.status === 'REMOVED' || post.kind === 'VIDEO') {
    return NextResponse.json({ error: 'Ese post no existe.' }, { status: 404 });
  }

  const existing = await prisma.verdict.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { vote: true },
  });

  let myVerdict: 'GUILTY' | 'INNOCENT' | null = vote;
  if (existing?.vote === vote) {
    await prisma.verdict.delete({ where: { postId_userId: { postId, userId } } });
    myVerdict = null;
  } else {
    await prisma.verdict.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, vote },
      update: { vote },
    });
  }

  const [guilty, total] = await Promise.all([
    prisma.verdict.count({ where: { postId, vote: 'GUILTY' } }),
    prisma.verdict.count({ where: { postId } }),
  ]);

  return NextResponse.json({ ok: true, guilty, innocent: total - guilty, myVerdict });
}
