import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { notify } from '@/lib/notifications';

/** Toggle: si ya diste like lo saca, si no lo pone. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }
  const userId = session.user.id;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  });
  if (!post || post.status === 'REMOVED') {
    return NextResponse.json({ error: 'Ese clip no existe.' }, { status: 404 });
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    // El unique (postId, userId) cubre el doble click; si corre dos veces
    // en paralelo la segunda falla y la ignoramos.
    await prisma.postLike
      .create({ data: { postId, userId } })
      .catch(() => undefined);
    // Notificamos al autor del clip que recibió un like.
    await notify({ userId: post.authorId, actorId: userId, type: 'LIKE', postId });
  }

  const likeCount = await prisma.postLike.count({ where: { postId } });

  return NextResponse.json({ ok: true, liked: !existing, likeCount });
}
