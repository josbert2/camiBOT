'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Image01Icon, Cancel01Icon, IncognitoIcon, SentIcon } from '@hugeicons/core-free-icons';
import { useLogin } from '../comunidad/login-gate';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_MB = 10;

async function uploadImage(file: File): Promise<string> {
  const signRes = await fetch('/api/community/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, contentLength: file.size, kind: 'image' }),
  });
  const signed = await signRes.json().catch(() => null);
  if (!signRes.ok) throw new Error(signed?.error ?? 'No se pudo firmar la subida.');

  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`R2 rechazó la subida (${put.status}).`);
  return signed.key as string;
}

function imageSize(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function DiscussionComposer({
  isAuthed,
  r2Ready,
}: {
  isAuthed: boolean;
  r2Ready: boolean;
}) {
  const router = useRouter();
  const openLogin = useLogin();
  const inputRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState('');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={openLogin}
        className="hud-panel mb-8 w-full p-4 text-left text-sm text-muted-foreground transition hover:border-border-strong"
      >
        Entrá para abrir un tema o reportar…
      </button>
    );
  }

  function reset() {
    if (image) URL.revokeObjectURL(image.url);
    setBody('');
    setImage(null);
    setAnon(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`La foto pesa demasiado. Máximo ${MAX_MB} MB.`);
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    setImage({ file, url: URL.createObjectURL(file) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!body.trim() && !image) {
      setError('Escribí algo o subí una foto.');
      return;
    }
    setError(null);
    try {
      let imageKey: string | null = null;
      let width: number | null = null;
      let height: number | null = null;

      if (image) {
        setBusy('Subiendo la foto…');
        imageKey = await uploadImage(image.file);
        const size = await imageSize(image.url);
        width = size?.w ?? null;
        height = size?.h ?? null;
      }

      setBusy('Publicando…');
      const res = await fetch('/api/community/discussion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: body.trim() || null, imageKey, width, height, anonymous: anon }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo publicar.');

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={submit} className="hud-panel mb-8 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 2000))}
        rows={3}
        placeholder="Abrí un tema, compartí una prueba, reportá…"
        className="w-full resize-none border-2 border-border bg-input px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-border-strong"
      />

      {image && (
        <div className="relative mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="max-h-64 border-2 border-border object-contain" />
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(image.url);
              setImage(null);
            }}
            className="btn-ghost absolute right-2 top-2 !border-border-strong bg-background/80 text-xs"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {r2Ready && (
          <label className="btn-ghost cursor-pointer text-xs">
            <HugeiconsIcon icon={Image01Icon} className="h-4 w-4" />
            <span>Foto</span>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
          </label>
        )}

        <button
          type="button"
          onClick={() => setAnon((a) => !a)}
          title="Publicar sin mostrar tu nombre"
          className={`btn-ghost text-xs ${anon ? '!border-accent !text-accent' : ''}`}
        >
          <HugeiconsIcon icon={IncognitoIcon} className="h-4 w-4" />
          <span>{anon ? 'Anónimo: ON' : 'Anónimo'}</span>
        </button>

        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          {busy}
        </span>
        <button type="submit" disabled={!!busy} className="btn-tactical text-xs disabled:opacity-50">
          <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
          <span>{busy ? '…' : 'Publicar'}</span>
        </button>
      </div>

      {anon && (
        <p className="mt-2 text-[10px] uppercase tracking-widest text-accent">
          Se va a ver como “Anónimo”. Igual queda registrado para moderación.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
