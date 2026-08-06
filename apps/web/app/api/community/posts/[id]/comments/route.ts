import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { COMMENT_MAX, discordAvatarUrl, getComments } from '@/lib/community';
import { containsProfanity } from '@/lib/profanity';

const createSchema = z.object({
  body: z.string().min(1).max(COMMENT_MAX),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const session = await auth();
  return NextResponse.json({ ok: true, comments: await getComments(session, postId) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `El comentario va de 1 a ${COMMENT_MAX} caracteres.` },
      { status: 400 },
    );
  }

  const body = parsed.data.body.trim();
  if (!body) {
    return NextResponse.json({ error: 'El comentario está vacío.' }, { status: 400 });
  }
  if (containsProfanity(body)) {
    return NextResponse.json(
      { error: 'Bajá un cambio con el texto y volvé a intentar.' },
      { status: 422 },
    );
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });
  if (!post || post.status === 'REMOVED') {
    return NextResponse.json({ error: 'Ese clip no existe.' }, { status: 404 });
  }

  const created = await prisma.postComment.create({
    data: { postId, authorId: session.user.id, body },
    include: {
      author: {
        select: {
          id: true,
          discordId: true,
          username: true,
          globalName: true,
          avatar: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      comment: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        author: {
          id: created.author.id,
          name: created.author.globalName ?? created.author.username,
          username: created.author.username,
          avatarUrl: discordAvatarUrl(created.author.discordId, created.author.avatar),
        },
        canDelete: true,
      },
    },
    { status: 201 },
  );
}
