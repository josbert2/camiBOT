import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MULTIPART_PART_SIZE,
  buildKey,
  createMultipart,
  presignPart,
  completeMultipart,
  abortMultipart,
  keyBelongsToUser,
  isR2Configured,
  r2MissingVars,
} from '@/lib/r2';

/**
 * Subida multipart resiliente para videos grandes en redes malas. El cliente
 * parte el archivo, sube cada parte con reintento y ensambla al final. Si se
 * corta una parte solo se reintenta esa, no todo el video.
 *
 * Acciones (body.action): create | sign | complete | abort.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: `Subida deshabilitada: faltan ${r2MissingVars().join(', ')} en el .env` },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === 'create') {
      const contentType = String(body.contentType ?? '');
      const contentLength = Number(body.contentLength ?? 0);
      if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(contentType)) {
        return NextResponse.json({ error: 'Formato de video no soportado.' }, { status: 415 });
      }
      if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_VIDEO_BYTES) {
        return NextResponse.json(
          { error: `El video supera el máximo de ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.` },
          { status: 413 },
        );
      }
      const key = buildKey(userId, 'video', contentType);
      const uploadId = await createMultipart(key, contentType);
      const partSize = MULTIPART_PART_SIZE;
      const partCount = Math.ceil(contentLength / partSize);
      return NextResponse.json({ ok: true, key, uploadId, partSize, partCount });
    }

    // El resto de las acciones operan sobre una key que debe ser del usuario.
    const key = String(body?.key ?? '');
    const uploadId = String(body?.uploadId ?? '');
    if (!key || !uploadId || !keyBelongsToUser(key, userId)) {
      return NextResponse.json({ error: 'Subida inválida.' }, { status: 400 });
    }

    if (action === 'sign') {
      const partNumber = Number(body.partNumber);
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return NextResponse.json({ error: 'Parte inválida.' }, { status: 400 });
      }
      const url = await presignPart(key, uploadId, partNumber);
      return NextResponse.json({ ok: true, url });
    }

    if (action === 'complete') {
      const rawParts = Array.isArray(body.parts) ? body.parts : [];
      const parts = rawParts
        .map((p: unknown) => {
          const o = p as { PartNumber?: unknown; ETag?: unknown };
          return { PartNumber: Number(o.PartNumber), ETag: String(o.ETag ?? '') };
        })
        .filter((p: { PartNumber: number; ETag: string }) => p.PartNumber >= 1 && p.ETag);
      if (parts.length === 0) {
        return NextResponse.json({ error: 'Sin partes para ensamblar.' }, { status: 400 });
      }
      await completeMultipart(key, uploadId, parts);
      return NextResponse.json({ ok: true, key });
    }

    if (action === 'abort') {
      await abortMultipart(key, uploadId).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (err) {
    console.error('[community] multipart error', err);
    return NextResponse.json({ error: 'Error en la subida.' }, { status: 500 });
  }
}
