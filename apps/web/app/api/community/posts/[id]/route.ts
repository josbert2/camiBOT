import { NextResponse } from 'next/server';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { canDelete } from '@/lib/community';
import { deleteObjects, isR2Configured } from '@/lib/r2';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, videoKey: true, posterKey: true, status: true },
  });

  if (!post || post.status === 'REMOVED') {
    return NextResponse.json({ error: 'Ese clip no existe.' }, { status: 404 });
  }

  if (!canDelete(session, post.authorId)) {
    return NextResponse.json({ error: 'No podés borrar este clip.' }, { status: 403 });
  }

  // Soft delete: deja rastro de quien lo bajo, y el feed filtra por PUBLISHED.
  await prisma.post.update({
    where: { id },
    data: {
      status: 'REMOVED',
      removedAt: new Date(),
      removedById: session.user.id,
    },
  });

  // Los objetos de R2 se van igual — no tiene sentido pagar storage por algo
  // que ya nadie puede ver. Best-effort: si falla, el post ya esta oculto.
  if (isR2Configured()) {
    try {
      await deleteObjects([post.videoKey, post.posterKey ?? '']);
    } catch (err) {
      console.error('[community] no se pudieron borrar los objetos de R2', err);
    }
  }

  return NextResponse.json({ ok: true });
}
