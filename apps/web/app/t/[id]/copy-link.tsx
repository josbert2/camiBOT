'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share08Icon, Tick02Icon } from '@hugeicons/core-free-icons';

/** Copia el link de registro del torneo al portapapeles. */
export function CopyLink({ path, label = 'Copiar link' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 border-2 border-border px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
    >
      <HugeiconsIcon icon={copied ? Tick02Icon : Share08Icon} className="h-4 w-4" />
      {copied ? 'Copiado' : label}
    </button>
  );
}
