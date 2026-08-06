import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { CAPTION_MAX, GAME_MODES, getFeed } from '@/lib/community';
import { containsProfanity } from '@/lib/profanity';

/** Techo simple contra el spam de subidas. */
const MAX_POSTS_PER_HOUR = 10;

const createSchema = z.object({
  videoKey: z.string().min(1),
  posterKey: z.string().min(1).nullable().optional(),
  caption: z.string().max(CAPTION_MAX).nullable().optional(),
  durationSec: z.number().int().positive().max(3600).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sizeBytes: z.number().int().positive().nullable().optional(),
  weaponId: z.string().max(120).nullable().optional(),
  weaponName: z.string().max(120).nullable().optional(),
  gameMode: z.enum(GAME_MODES).nullable().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);

  const feed = await getFeed(session, {
    weaponId: searchParams.get('weaponId') ?? undefined,
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

  const data = parsed.data;
  const userId = session.user.id;

  // Las keys las firma /upload-url con prefijo community/<userId>/. Revalidamos
  // acá para que nadie reclame como propio un objeto ajeno.
  const prefix = `community/${userId}/`;
  if (!data.videoKey.startsWith(prefix)) {
    return NextResponse.json({ error: 'La key del video no es tuya.' }, { status: 403 });
  }
  if (data.posterKey && !data.posterKey.startsWith(prefix)) {
    return NextResponse.json({ error: 'La key del poster no es tuya.' }, { status: 403 });
  }

  const caption = data.caption?.trim() || null;
  if (caption && containsProfanity(caption)) {
    return NextResponse.json(
      { error: 'Bajá un cambio con el texto y volvé a intentar.' },
      { status: 422 },
    );
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.post.count({
    where: { authorId: userId, createdAt: { gte: since } },
  });
  if (recent >= MAX_POSTS_PER_HOUR) {
    return NextResponse.json(
      { error: `Máximo ${MAX_POSTS_PER_HOUR} clips por hora. Probá más tarde.` },
      { status: 429 },
    );
  }

  const post = await prisma.post.create({
    data: {
      authorId: userId,
      videoKey: data.videoKey,
      posterKey: data.posterKey ?? null,
      caption,
      durationSec: data.durationSec ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      sizeBytes: data.sizeBytes ?? null,
      weaponId: data.weaponId ?? null,
      weaponName: data.weaponName ?? null,
      gameMode: data.gameMode ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: post.id }, { status: 201 });
}
