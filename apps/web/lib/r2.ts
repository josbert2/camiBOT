import { S3Client, DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 (S3-compatible).
 *
 * Los videos NO pasan por el server de Next: el cliente pide una URL
 * prefirmada y sube directo al bucket. Next solo firma, valida y guarda
 * la key en la DB.
 *
 * Env necesarias:
 *   R2_ACCOUNT_ID         — el id de cuenta de Cloudflare
 *   R2_ACCESS_KEY_ID      — token de API R2 con permiso de escritura
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET             — nombre del bucket
 *   R2_PUBLIC_URL         — host publico del bucket (dominio propio o r2.dev),
 *                           sin barra final. Es lo que se sirve al browser.
 */

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_POSTER_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const ALLOWED_POSTER_TYPES = ['image/jpeg', 'image/webp'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

/** Falta alguna credencial? Lo usamos para degradar la UI con un mensaje claro. */
export function r2MissingVars(): string[] {
  return [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_URL',
  ].filter((k) => !env(k));
}

export function isR2Configured(): boolean {
  return r2MissingVars().length === 0;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(`R2 sin configurar. Faltan: ${r2MissingVars().join(', ')}`);
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

function bucket(): string {
  const b = env('R2_BUCKET');
  if (!b) throw new Error('R2_BUCKET sin configurar');
  return b;
}

/** URL publica de una key guardada en la DB. */
export function publicUrl(key: string): string {
  const base = env('R2_PUBLIC_URL');
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/${key}`;
}

/**
 * Key con prefijo por usuario y sufijo aleatorio. El userId adelante hace
 * trivial auditar o borrar todo lo de una persona desde el dashboard de R2.
 */
export function buildKey(userId: string, kind: 'video' | 'poster', contentType: string): string {
  const ext = EXT_BY_TYPE[contentType] ?? 'bin';
  const rand = crypto.randomUUID();
  return `community/${userId}/${rand}-${kind}.${ext}`;
}

/** URL prefirmada de PUT. El browser sube el archivo directo a R2. */
export async function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300 },
  );
}

/**
 * Borra los objetos de un post. Best-effort: si R2 falla no queremos
 * bloquear el borrado del post en la DB, solo dejar el log.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  const clean = keys.filter(Boolean);
  if (clean.length === 0) return;

  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: clean.map((Key) => ({ Key })) },
    }),
  );
}
