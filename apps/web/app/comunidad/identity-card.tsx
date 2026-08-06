'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Login03Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import type { ProfileSummary } from '@/lib/community';
import { useLogin } from './login-gate';

/** Card de perfil del sidebar izquierdo. Prompt de login si no hay sesión. */
export function IdentityCard({ profile }: { profile: ProfileSummary | null }) {
  const openLogin = useLogin();

  if (!profile) {
    return (
      <div className="hud-panel p-5">
        <div className="tag-tactical mb-3 flex items-center gap-2">
          <HugeiconsIcon icon={UserGroupIcon} className="h-3.5 w-3.5" />
          <span>// OPERADOR</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Entrá con Discord para armar tu perfil, subir clips y sumar reacciones.
        </p>
        <button onClick={openLogin} className="btn-tactical mt-4 w-full justify-center text-xs">
          <HugeiconsIcon icon={Login03Icon} className="h-4 w-4" />
          <span>Iniciar sesión</span>
        </button>
      </div>
    );
  }

  const { author, postCount, likesReceived } = profile;

  return (
    <div className="hud-panel overflow-hidden">
      <div className="h-16 border-b border-border bg-gradient-to-br from-primary/25 to-accent/10 scanlines" />
      <div className="px-5 pb-5">
        <div className="-mt-9 mb-3">
          {author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatarUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 border-2 border-border-strong object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center border-2 border-border-strong bg-muted">
              <span className="display text-lg text-muted-foreground">
                {author.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <p className="display truncate text-xl tracking-wide">{author.name}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          @{author.username}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Clips" value={postCount} />
          <Stat label="Likes" value={likesReceived} />
        </div>

        <Link
          href="/perfil"
          className="btn-ghost mt-3 w-full justify-center text-[10px]"
        >
          Ver mi perfil
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-block !p-3">
      <div className="display text-2xl leading-none text-foreground">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
