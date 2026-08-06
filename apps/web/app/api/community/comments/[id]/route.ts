import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { canDelete } from '@/lib/community';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const comment = await prisma.postComment.findUnique({
    where: { id },
    select: { id: true, authorId: true, removedAt: true },
  });

  if (!comment || comment.removedAt) {
    return NextResponse.json({ error: 'Ese comentario no existe.' }, { status: 404 });
  }

  if (!canDelete(session, comment.authorId)) {
    return NextResponse.json({ error: 'No podés borrar este comentario.' }, { status: 403 });
  }

  await prisma.postComment.update({
    where: { id },
    data: { removedAt: new Date(), removedById: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
