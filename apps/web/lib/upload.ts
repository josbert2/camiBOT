/**
 * Subida de video resiliente a R2 vía multipart. Pensada para redes malas
 * (datos móviles con cortes): parte el archivo, sube cada trozo con XHR
 * (progreso real) y reintentos con backoff, y ensambla al final. Si un trozo
 * falla, se reintenta solo ese — no todo el video.
 */

export type ProgressCb = (ratio: number) => void;

type CreateRes = { key: string; uploadId: string; partSize: number; partCount: number };

async function api<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/community/multipart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? 'Error en la subida.');
  return json as T;
}

/** PUT de una parte por XHR, con progreso. Devuelve el ETag. */
function xhrPut(url: string, body: Blob, onLoaded: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag') ?? '');
      } else {
        reject(new Error(`R2 respondió ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado'));
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sube una parte reintentando (re-firma la URL en cada intento por si expiró). */
async function putPartWithRetry(
  key: string,
  uploadId: string,
  partNumber: number,
  blob: Blob,
  onLoaded: (loaded: number) => void,
  attempts = 5,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { url } = await api<{ url: string }>('sign', { key, uploadId, partNumber });
      return await xhrPut(url, blob, onLoaded);
    } catch (err) {
      lastErr = err;
      onLoaded(0); // reseteamos el progreso de esta parte para el reintento
      await sleep(Math.min(8000, 600 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo subir una parte.');
}

/**
 * Sube un video con multipart resiliente. `onProgress` recibe 0..1.
 * Devuelve la key final en R2.
 */
export async function uploadVideoResilient(blob: Blob, onProgress?: ProgressCb): Promise<string> {
  const { key, uploadId, partSize, partCount } = await api<CreateRes>('create', {
    contentType: blob.type || 'video/mp4',
    contentLength: blob.size,
    kind: 'video',
  });

  const loaded = new Array(partCount).fill(0) as number[];
  const total = blob.size;
  const report = () => onProgress?.(Math.min(1, loaded.reduce((a, b) => a + b, 0) / total));

  const parts: { PartNumber: number; ETag: string }[] = [];
  try {
    for (let i = 0; i < partCount; i++) {
      const start = i * partSize;
      const chunk = blob.slice(start, Math.min(start + partSize, total));
      const etag = await putPartWithRetry(key, uploadId, i + 1, chunk, (l) => {
        loaded[i] = l;
        report();
      });
      loaded[i] = chunk.size;
      report();
      parts.push({ PartNumber: i + 1, ETag: etag });
    }

    await api('complete', { key, uploadId, parts });
    onProgress?.(1);
    return key;
  } catch (err) {
    // No dejamos multipart colgado en R2.
    api('abort', { key, uploadId }).catch(() => {});
    throw err;
  }
}
