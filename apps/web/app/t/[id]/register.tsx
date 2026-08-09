'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/** Botón de registro/baja al torneo desde la web. */
export function TournamentRegister({
  tournamentId,
  isAuthed,
  regOpen,
  isFull,
  isRegistered,
  teamSize,
}: {
  tournamentId: string;
  isAuthed: boolean;
  regOpen: boolean;
  isFull: boolean;
  isRegistered: boolean;
  teamSize: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');

  async function call(method: 'POST' | 'DELETE') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ teamName }) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo procesar.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setBusy(false);
    }
  }

  // Registro cerrado: si ya estás dentro, se avisa; si no, no se muestra nada.
  if (!regOpen) {
    return isRegistered ? (
      <span className="inline-flex items-center gap-2 border-2 border-success px-4 py-2 text-xs font-bold uppercase tracking-widest text-success">
        ✓ Estás inscripto
      </span>
    ) : null;
  }

  if (!isAuthed) {
    return (
      <Link
        href="/login"
        className="inline-flex border-2 border-border-strong bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-foreground hover:text-background"
      >
        Iniciá sesión para registrarte
      </Link>
    );
  }

  if (isRegistered) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 border-2 border-success px-4 py-2 text-xs font-bold uppercase tracking-widest text-success">
          ✓ Estás registrado
        </span>
        <button
          onClick={() => call('DELETE')}
          disabled={busy}
          className="border-2 border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition hover:border-danger hover:text-danger disabled:opacity-50"
        >
          {busy ? '…' : 'Salir'}
        </button>
        {error && <p className="w-full text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (isFull) {
    return (
      <span className="inline-flex border-2 border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Cupos llenos
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {teamSize > 1 && (
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value.slice(0, 60))}
          placeholder="Nombre del equipo"
          className="border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-border-strong"
        />
      )}
      <button
        onClick={() => call('POST')}
        disabled={busy}
        className="inline-flex border-2 border-border-strong bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        {busy ? 'Registrando…' : 'Registrarme'}
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
