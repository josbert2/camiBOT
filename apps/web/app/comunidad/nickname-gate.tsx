'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';

/**
 * Modal de bienvenida: si el usuario nunca eligió apodo, le pide crear uno
 * (ej: Chapy) o seguir con su nombre de Discord.
 */
export function NicknameGate({
  needsNickname,
  discordName,
}: {
  needsNickname: boolean;
  discordName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(needsNickname);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(payload: { nickname?: string; skip?: boolean }, which: 'save' | 'skip') {
    if (busy) return;
    setBusy(which);
    setError(null);
    try {
      const res = await fetch('/api/community/nickname', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo guardar.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

      <div className="hud-panel-strong relative z-10 w-full max-w-md p-8 scanlines">
        <div className="mb-2 flex items-center gap-2 tag-tactical text-primary">
          <HugeiconsIcon icon={UserGroupIcon} className="h-3.5 w-3.5" />
          <span>// IDENTIFICATE</span>
        </div>
        <h2 className="stencil text-4xl leading-none">Creá tu nombre de operador</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Así te van a ver en la comunidad, el ranking y los comentarios.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit({ nickname }, 'save');
          }}
          className="mt-5"
        >
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 24))}
            autoFocus
            placeholder="Ej: Chapy"
            className="w-full border-2 border-border bg-input px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-border-strong"
          />
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={!!busy || nickname.trim().length < 2}
            className="btn-tactical mt-4 w-full justify-center disabled:opacity-50"
          >
            {busy === 'save' ? 'Guardando…' : 'Usar este nombre'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void submit({ skip: true }, 'skip')}
          disabled={!!busy}
          className="mt-3 w-full text-center text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          {busy === 'skip' ? 'Un momento…' : `No, usar mi nombre de Discord (${discordName})`}
        </button>
      </div>
    </div>
  );
}
