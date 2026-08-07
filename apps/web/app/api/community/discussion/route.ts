import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { getDiscussionFeed } from '@/lib/community';
import { containsProfanity } from '@/lib/profanity';

const MAX_POSTS_PER_HOUR = 15;

const createSchema = z.object({
  body: z.string().max(2000).nullable().optional(),
  imageKey: z.string().min(1).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  anonymous: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const feed = await getDiscussionFeed(session, {
    cursor: searchParams.get('cursor') ?? undefined,
  });
  return NextResponse.json(feed);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  const userId = session.user.id;
  const data = parsed.data;

  const body = data.body?.trim() || null;
  const imageKey = data.imageKey || null;

  if (!body && !imageKey) {
    return NextResponse.json({ error: 'Escribí algo o subí una foto.' }, { status: 400 });
  }
  if (body && body.length > 2000) {
    return NextResponse.json({ error: 'El texto es muy largo.' }, { status: 400 });
  }
  if (imageKey && !imageKey.startsWith(`community/${userId}/`)) {
    return NextResponse.json({ error: 'La imagen no es tuya.' }, { status: 403 });
  }
  if (body && containsProfanity(body)) {
    return NextResponse.json({ error: 'Bajá un cambio con el texto.' }, { status: 422 });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.post.count({ where: { authorId: userId, createdAt: { gte: since } } });
  if (recent >= MAX_POSTS_PER_HOUR) {
    return NextResponse.json({ error: `Máximo ${MAX_POSTS_PER_HOUR} posts por hora.` }, { status: 429 });
  }

  const post = await prisma.post.create({
    data: {
      authorId: userId,
      kind: imageKey ? 'PHOTO' : 'TEXT',
      anonymous: data.anonymous ?? false,
      imageKey,
      // Reusamos caption como cuerpo del post de discusión.
      caption: body,
      width: data.width ?? null,
      height: data.height ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: post.id }, { status: 201 });
}
