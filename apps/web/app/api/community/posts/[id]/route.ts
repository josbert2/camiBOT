import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@camibot/db';
import { auth } from '@/auth';
import { canDelete, normalizeSlug } from '@/lib/community';
import { deleteObjects, isR2Configured } from '@/lib/r2';

/** Setear/limpiar el slug de un clip (solo autor o admin). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true },
  });
  if (!post || post.status === 'REMOVED') {
    return NextResponse.json({ error: 'Ese clip no existe.' }, { status: 404 });
  }
  if (!canDelete(session, post.authorId)) {
    return NextResponse.json({ error: 'No podés editar este clip.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.slug === 'string' ? body.slug.trim() : '';

  // Vacío => limpia el slug (vuelve a la URL por id).
  let slug: string | null = null;
  if (raw) {
    slug = normalizeSlug(raw);
    if (!slug) {
      return NextResponse.json(
        { error: 'La URL debe tener al menos 3 letras o números.' },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.post.update({ where: { id }, data: { slug } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Esa URL ya está en uso.' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, slug });
}

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
