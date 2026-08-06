'use client';

import { useEffect, useRef, useState } from 'react';

type MentionUser = { id: string; username: string; name: string; avatarUrl: string | null };

/**
 * Input de comentario con autocompletar de @menciones (estilo WhatsApp):
 * al escribir "@" y texto, muestra un dropdown de usuarios; al elegir uno,
 * inserta "@usuario ".
 */
export function MentionInput({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const queryRef = useRef<string>('');

  // Detecta el token @query justo antes del cursor.
  function detectQuery(): string | null {
    const el = inputRef.current;
    if (!el) return null;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w.]{0,20})$/);
    return m ? (m[1] ?? '') : null;
  }

  useEffect(() => {
    if (!open) return;
    const q = queryRef.current;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/community/users?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!cancelled) {
          setUsers(json.users ?? []);
          setActive(0);
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, value]);

  function refreshQuery() {
    const q = detectQuery();
    if (q === null) {
      setOpen(false);
      return;
    }
    queryRef.current = q;
    setOpen(true);
  }

  function pick(u: MentionUser) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\w.]{0,20})$/, `@${u.username} `);
    const after = value.slice(caret);
    const next = (before + after).slice(0, maxLength ?? 99999);
    onChange(next);
    setOpen(false);
    // Reposiciona el cursor tras la mención.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(before.length, before.length);
      }
    });
  }

  return (
    <div className="relative min-w-0 flex-1">
      {open && users.length > 0 && (
        <ul className="absolute bottom-full left-0 z-40 mb-1 max-h-56 w-64 overflow-y-auto border-2 border-border-strong bg-card">
          {users.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(u);
                }}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition ${
                  i === active ? 'bg-muted' : 'hover:bg-muted'
                }`}
              >
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" className="h-6 w-6 border border-border object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center border border-border bg-muted text-[9px] text-muted-foreground">
                    {u.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs">{u.name}</span>
                <span className="text-[10px] text-muted-foreground">@{u.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value);
          // detect tras aplicar el cambio
          requestAnimationFrame(refreshQuery);
        }}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) refreshQuery();
        }}
        onKeyDown={(e) => {
          if (!open || users.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % users.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + users.length) % users.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const u = users[active];
            if (u) pick(u);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
