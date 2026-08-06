'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  VideoReplayIcon,
  Upload04Icon,
  Cancel01Icon,
  Login03Icon,
  ScissorIcon,
} from '@hugeicons/core-free-icons';
import { CAPTION_MAX, GAME_MODES } from '@/lib/community';
import { useLogin } from './login-gate';
import { VideoTrimmer } from './video-trimmer';

// ffmpeg.wasm se carga on-demand (dynamic import) para no pesar en el bundle
// del feed: solo entra cuando alguien realmente abre el uploader.

export type WeaponOption = { id: string; name: string };

const ACCEPT = 'video/mp4,video/webm,video/quicktime';
const MAX_MB = 100;

type Picked = {
  file: File;
  previewUrl: string;
  duration: number | null; // segundos (float) para el recorte
  durationSec: number | null; // redondeado, para guardar
  width: number | null;
  height: number | null;
  poster: Blob | null;
};

/**
 * Lee metadata del video y saca un frame para usar de poster, todo en el
 * browser. Asi evitamos ffmpeg en el server: el poster viaja como un jpg mas.
 */
async function inspect(file: File): Promise<Omit<Picked, 'file'>> {
  const previewUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = previewUrl;

  const meta = await new Promise<{ d: number; w: number; h: number } | null>((resolve) => {
    const done = () =>
      resolve({
        d: Number.isFinite(video.duration) ? video.duration : 0,
        w: video.videoWidth,
        h: video.videoHeight,
      });
    video.onloadedmetadata = done;
    video.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
  });

  if (!meta || !meta.w) {
    return { previewUrl, duration: null, durationSec: null, width: null, height: null, poster: null };
  }

  // Un frame temprano pero no el 0: el primero suele ser negro.
  const target = Math.min(1, Math.max(0, meta.d * 0.1));
  const poster = await new Promise<Blob | null>((resolve) => {
    const grab = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = meta.w;
        canvas.height = meta.h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
      } catch {
        resolve(null);
      }
    };
    video.onseeked = grab;
    video.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
    video.currentTime = target;
  });

  return {
    previewUrl,
    duration: meta.d || null,
    durationSec: meta.d ? Math.round(meta.d) : null,
    width: meta.w,
    height: meta.h,
    poster,
  };
}

async function uploadToR2(blob: Blob, kind: 'video' | 'poster'): Promise<string> {
  const signRes = await fetch('/api/community/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentType: blob.type,
      contentLength: blob.size,
      kind,
    }),
  });

  const signed = await signRes.json().catch(() => null);
  if (!signRes.ok) throw new Error(signed?.error ?? 'No se pudo firmar la subida.');

  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'content-type': blob.type },
    body: blob,
  });
  if (!put.ok) throw new Error(`R2 rechazó la subida (${put.status}).`);

  return signed.key as string;
}

export function Composer({
  isAuthed,
  r2Ready,
  disabledReason,
}: {
  isAuthed: boolean;
  r2Ready: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const openLogin = useLogin();
  const inputRef = useRef<HTMLInputElement>(null);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [gameMode, setGameMode] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const closeModal = () => {
    if (busy) return;
    reset();
    setOpen(false);
  };

  // Escape para cerrar + lock de scroll mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        reset();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function reset() {
    if (picked) URL.revokeObjectURL(picked.previewUrl);
    setPicked(null);
    setCaption('');
    setGameMode('');
    setTrimStart(0);
    setTrimEnd(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El clip pesa ${(file.size / 1024 / 1024).toFixed(0)} MB. El máximo es ${MAX_MB} MB.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy('Leyendo el clip…');
    try {
      const info = await inspect(file);
      setPicked({ file, ...info });
      setTrimStart(0);
      setTrimEnd(info.duration ?? 0);
      // Precargamos el core de ffmpeg (dynamic import) para que el recorte no
      // espere la descarga, sin sumar peso al bundle del feed.
      import('@/lib/ffmpeg-trim').then((m) => m.preloadFFmpeg()).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || busy) return;

    setError(null);
    try {
      // Recorte opcional: si el rango no cubre todo el clip, re-encodeamos.
      let videoBlob: Blob = picked.file;
      let durationSec = picked.durationSec;
      const full = picked.duration ?? 0;
      const isTrimmed = full > 0 && (trimStart > 0.05 || trimEnd < full - 0.05);

      if (isTrimmed) {
        setBusy('Recortando el clip… 0%');
        const { trimVideo } = await import('@/lib/ffmpeg-trim');
        videoBlob = await trimVideo(picked.file, trimStart, trimEnd, (r) =>
          setBusy(`Recortando el clip… ${Math.round(r * 100)}%`),
        );
        durationSec = Math.round(trimEnd - trimStart);
      }

      setBusy('Subiendo el video…');
      const videoKey = await uploadToR2(videoBlob, 'video');

      let posterKey: string | null = null;
      if (picked.poster) {
        setBusy('Subiendo la miniatura…');
        try {
          posterKey = await uploadToR2(picked.poster, 'poster');
        } catch {
          // Sin poster el feed igual funciona; no abortamos por esto.
          posterKey = null;
        }
      }

      setBusy('Publicando…');
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoKey,
          posterKey,
          caption: caption.trim() || null,
          durationSec,
          width: picked.width,
          height: picked.height,
          sizeBytes: videoBlob.size,
          weaponId: null,
          weaponName: null,
          gameMode: gameMode || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo publicar.');

      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setBusy(null);
    }
  }

  // Sin sesión: barra tipo "compartí tu play" que abre el modal de login.
  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={openLogin}
        className="hud-panel mb-10 flex w-full items-center gap-4 p-4 text-left transition hover:border-border-strong"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-muted">
          <HugeiconsIcon icon={VideoReplayIcon} className="h-5 w-5 text-primary" />
        </span>
        <span className="flex-1 border-2 border-border bg-input px-4 py-3 text-sm text-muted-foreground">
          Compartí tu mejor play…
        </span>
        <span className="btn-tactical pointer-events-none hidden text-xs sm:inline-flex">
          <HugeiconsIcon icon={Login03Icon} className="h-4 w-4" />
          <span>Entrar</span>
        </span>
      </button>
    );
  }

  // Logueado pero sin R2 configurado: se explica por qué no se puede subir.
  if (!r2Ready) {
    return (
      <div className="hud-panel mb-10 p-6">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={VideoReplayIcon} className="h-3.5 w-3.5" />
          <span>// SUBIR CLIP</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {disabledReason ?? 'La subida está deshabilitada.'}
        </p>
      </div>
    );
  }

  // Logueado y con R2 listo: botón colapsado que abre el uploader en modal.
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hud-panel mb-10 flex w-full items-center gap-4 p-4 text-left transition hover:border-border-strong"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-muted">
          <HugeiconsIcon icon={VideoReplayIcon} className="h-5 w-5 text-primary" />
        </span>
        <span className="flex-1 border-2 border-border bg-input px-4 py-3 text-sm text-muted-foreground">
          Compartí tu mejor play…
        </span>
        <span className="btn-tactical pointer-events-none text-xs">
          <HugeiconsIcon icon={Upload04Icon} className="h-4 w-4" />
          <span className="hidden sm:inline">Subir clip</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeModal}
            className="fixed inset-0 bg-background/85 backdrop-blur-sm"
          />
          <form
            onSubmit={onSubmit}
            className="hud-panel-strong relative z-10 my-auto w-full max-w-2xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 tag-tactical">
                <HugeiconsIcon icon={VideoReplayIcon} className="h-3.5 w-3.5" />
                <span>// SUBIR CLIP</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={!!busy}
                aria-label="Cerrar"
                className="border-2 border-transparent p-1.5 text-muted-foreground transition hover:border-border-strong hover:text-foreground disabled:opacity-40"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>

            {!picked ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-border px-6 py-12 text-center transition hover:border-border-strong">
          <HugeiconsIcon icon={Upload04Icon} className="h-8 w-8 text-primary" />
          <span className="display text-lg tracking-widest">Elegí tu play</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            MP4 · WEBM · MOV — hasta {MAX_MB} MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            className="hidden"
            disabled={!!busy}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <div className="mb-2 flex items-center justify-between">
              <span className="tag-tactical flex items-center gap-1.5">
                <HugeiconsIcon icon={ScissorIcon} className="h-3 w-3" />
                Editor · arrastrá las manijas para recortar
              </span>
              <button
                type="button"
                onClick={reset}
                disabled={!!busy}
                className="btn-ghost !border-border-strong text-xs"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
                <span>Cambiar</span>
              </button>
            </div>

            {picked.duration && picked.duration > 0.5 ? (
              <VideoTrimmer
                src={picked.previewUrl}
                duration={picked.duration}
                start={trimStart}
                end={trimEnd}
                disabled={!!busy}
                onChange={(s, e) => {
                  setTrimStart(s);
                  setTrimEnd(e);
                }}
              />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={picked.previewUrl}
                controls
                playsInline
                className="max-h-[380px] w-full bg-black object-contain"
              />
            )}
          </div>

          <div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              rows={2}
              placeholder="Contá la jugada…"
              className="w-full resize-none border-2 border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-border-strong"
            />
            <div className="mt-1 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
              {caption.length}/{CAPTION_MAX}
            </div>
          </div>

          <label className="block">
            <span className="tag-tactical mb-1 block">Modo</span>
            <select
              value={gameMode}
              onChange={(e) => setGameMode(e.target.value)}
              className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
            >
              <option value="">Sin especificar</option>
              {GAME_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {busy ?? `${(picked.file.size / 1024 / 1024).toFixed(1)} MB`}
              {!busy && picked.durationSec ? ` · ${picked.durationSec}s` : ''}
              {!busy && !picked.poster ? ' · sin miniatura' : ''}
            </span>
            <button type="submit" disabled={!!busy} className="btn-tactical disabled:opacity-50">
              <HugeiconsIcon icon={Upload04Icon} className="h-4 w-4" />
              <span>{busy ? 'Subiendo…' : 'Publicar'}</span>
            </button>
          </div>
        </div>
      )}

            {error && (
              <p className="mt-4 border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
