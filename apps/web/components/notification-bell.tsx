'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification03Icon } from '@hugeicons/core-free-icons';

type Item = {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'MENTION';
  read: boolean;
  createdAt: string;
  postId: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
};

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const VERB: Record<Item['type'], string> = {
  LIKE: 'le dio like a tu post',
  COMMENT: 'comentó tu post',
  MENTION: 'te mencionó',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch('/api/community/notifications');
      if (res.ok) {
        const j = await res.json();
        setItems(j.items ?? []);
        setUnread(j.unread ?? 0);
      }
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      fetch('/api/community/notifications', { method: 'POST' }).catch(() => {});
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        className="relative flex items-center border-2 border-border p-2 text-muted-foreground transition hover:border-border-strong hover:text-foreground"
      >
        <HugeiconsIcon icon={Notification03Icon} className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center border border-background bg-danger px-1 text-[9px] font-bold text-danger-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto border-2 border-border-strong bg-card">
            <div className="border-b border-border px-3 py-2 tag-tactical">// NOTIFICACIONES</div>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                Sin novedades
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  const inner = (
                    <div
                      className={`flex items-start gap-2 px-3 py-2 transition hover:bg-muted ${
                        n.read ? '' : 'bg-primary/5'
                      }`}
                    >
                      {n.actor?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.actor.avatarUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 border border-border object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted text-[9px] text-muted-foreground">
                          {(n.actor?.name ?? '??').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <p className="min-w-0 flex-1 text-xs leading-snug">
                        <span className="font-bold">{n.actor?.name ?? 'Alguien'}</span>{' '}
                        <span className="text-muted-foreground">{VERB[n.type]}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          · {timeAgo(n.createdAt)}
                        </span>
                      </p>
                      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 bg-primary" />}
                    </div>
                  );
                  return (
                    <li key={n.id} className="border-b border-border last:border-b-0">
                      {n.postId ? (
                        <Link href={`/c/${n.postId}`} onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
