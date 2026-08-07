import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_POSTER_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_POSTER_BYTES,
  MAX_VIDEO_BYTES,
  buildKey,
  isR2Configured,
  presignUpload,
  r2MissingVars,
} from '@/lib/r2';

const schema = z.object({
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
  kind: z.enum(['video', 'poster', 'image']),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: `Subida deshabilitada: faltan ${r2MissingVars().join(', ')} en el .env` },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  const { contentType, contentLength, kind } = parsed.data;

  const allowed: readonly string[] =
    kind === 'video'
      ? ALLOWED_VIDEO_TYPES
      : kind === 'image'
        ? ALLOWED_IMAGE_TYPES
        : ALLOWED_POSTER_TYPES;
  if (!allowed.includes(contentType)) {
    return NextResponse.json(
      { error: `Formato no soportado. Aceptamos: ${allowed.join(', ')}` },
      { status: 415 },
    );
  }

  const max =
    kind === 'video' ? MAX_VIDEO_BYTES : kind === 'image' ? MAX_IMAGE_BYTES : MAX_POSTER_BYTES;
  if (contentLength > max) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${Math.round(max / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  // La key se arma en el server: el cliente nunca elige dónde escribe.
  const key = buildKey(session.user.id, kind, contentType);
  const url = await presignUpload(key, contentType, contentLength);

  return NextResponse.json({ ok: true, key, url });
}
