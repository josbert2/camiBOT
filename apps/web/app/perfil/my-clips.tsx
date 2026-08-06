'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FavouriteIcon,
  Comment01Icon,
  VideoReplayIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';

export type MyClip = {
  id: string;
  caption: string | null;
  posterUrl: string | null;
  likes: number;
  comments: number;
};

/** Grilla de clips propios con borrado inline. */
export function MyClips({ clips: initial }: { clips: MyClip[] }) {
  const [clips, setClips] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    if (busyId) return;
    if (!window.confirm('¿Borrar este clip? No se puede deshacer.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/community/posts/${id}`, { method: 'DELETE' });
      if (res.ok) setClips((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (clips.length === 0) {
    return (
      <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        Todavía no subiste ningún clip.{' '}
        <Link href="/comunidad" className="text-primary hover:underline">
          Subí el primero
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {clips.map((c) => (
        <div key={c.id} className="hud-panel group relative overflow-hidden">
          <button
            type="button"
            onClick={() => remove(c.id)}
            disabled={busyId === c.id}
            title="Borrar clip"
            aria-label="Borrar clip"
            className="absolute right-1.5 top-1.5 z-10 border-2 border-transparent bg-background/80 p-1.5 text-muted-foreground opacity-0 transition hover:border-danger hover:text-danger group-hover:opacity-100 disabled:opacity-50"
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
          </button>

          <Link href={`/c/${c.id}`} className="block transition hover:opacity-95">
            <div className="relative aspect-video bg-black">
              {c.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.posterUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <HugeiconsIcon icon={VideoReplayIcon} className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="p-2">
              {c.caption && <p className="truncate text-xs">{c.caption}</p>}
              <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={FavouriteIcon} className="h-3 w-3" />
                  {c.likes}
                </span>
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={Comment01Icon} className="h-3 w-3" />
                  {c.comments}
                </span>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
