'use client';

import { useState } from 'react';

/** Comandos del bot con el slug del torneo ya puesto. Solo se renderiza a admins. */
export function AdminCommands({ slug }: { slug: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const commands: { label: string; cmd: string }[] = [
    { label: 'Iniciar el torneo (arma la llave)', cmd: `/tournament start name:${slug}` },
    { label: 'Panel para marcar ganadores', cmd: `/match panel tournament:${slug}` },
    { label: 'Abrir check-in (15 min)', cmd: `/tournament checkin-open name:${slug} minutes:15` },
    { label: 'Ver el torneo', cmd: `/tournament view name:${slug}` },
    { label: 'Cancelar el torneo', cmd: `/tournament cancel name:${slug}` },
  ];

  async function copy(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(cmd);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  }

  return (
    <section className="mb-8 border-2 border-accent/60 bg-card p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">
        [comandos del bot · solo admin]
      </div>
      <ul className="space-y-2">
        {commands.map(({ label, cmd }) => (
          <li key={cmd} className="flex items-center gap-3 border border-border bg-background px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              <code className="block truncate font-mono text-sm text-foreground">{cmd}</code>
            </div>
            <button
              type="button"
              onClick={() => copy(cmd)}
              className="shrink-0 border-2 border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
            >
              {copied === cmd ? 'Copiado' : 'Copiar'}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        Los jugadores reportan con /match report result:Gané.
      </p>
    </section>
  );
}
