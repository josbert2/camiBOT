'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateLeague({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || sel.size < 2) {
      setError('Poné un nombre y elegí al menos 2 jugadores.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), userIds: [...sel] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo crear.');
      router.push(`/liga/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="hud-panel p-6">
      <div className="mb-4 tag-tactical">// NUEVA LIGA</div>
      <label className="mb-4 block">
        <span className="tag-tactical mb-1 block">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Liga Verano"
          className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
        />
      </label>

      <div className="mb-2 flex items-center justify-between">
        <span className="tag-tactical">Jugadores</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {sel.size} elegidos
        </span>
      </div>
      <div className="mb-4 max-h-72 space-y-1 overflow-y-auto border-2 border-border p-2">
        {users.map((u) => (
          <label key={u.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-muted">
            <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} className="accent-primary" />
            <span className="truncate">{u.name}</span>
          </label>
        ))}
        {users.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No hay usuarios para agregar.</p>
        )}
      </div>

      <button type="submit" disabled={busy} className="btn-tactical disabled:opacity-50">
        {busy ? 'Creando…' : 'Crear liga (genera el fixture)'}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
