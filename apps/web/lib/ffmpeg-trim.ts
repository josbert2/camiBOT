import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Recorte de video en el browser con ffmpeg.wasm. Se carga el core on-demand
 * (single-thread, sin necesidad de COOP/COEP) desde el CDN la primera vez.
 * El clip se re-encodea a H.264/AAC, así queda normalizado a mp4.
 */

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';

async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    instance = ff;
    return ff;
  })();

  return loading;
}

/** Precarga el core (para dispararlo apenas se abre el editor). */
export function preloadFFmpeg(): void {
  void getFFmpeg().catch(() => {});
}

export async function trimVideo(
  file: File,
  startSec: number,
  endSec: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ff = await getFFmpeg();
  const inName = 'input';
  const outName = 'trim.mp4';
  const dur = Math.max(0.1, endSec - startSec);

  const handler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.min(1, Math.max(0, progress)));
  };
  ff.on('progress', handler);

  try {
    await ff.writeFile(inName, await fetchFile(file));
    await ff.exec([
      '-ss', startSec.toFixed(2),
      '-i', inName,
      '-t', dur.toFixed(2),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outName,
    ]);
    const data = (await ff.readFile(outName)) as Uint8Array;
    // Copia a un buffer propio (readFile puede venir sobre SharedArrayBuffer).
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    return new Blob([bytes], { type: 'video/mp4' });
  } finally {
    ff.off('progress', handler);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
  }
}
