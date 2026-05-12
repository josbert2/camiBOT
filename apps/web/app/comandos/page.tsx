import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comandos — camiBOT',
};

type Option = {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
  values?: string[];
};

type Cmd = {
  name: string;
  desc: string;
  options?: Option[];
  examples: string[];
  notes?: string;
  adminOnly?: boolean;
};

type Group = {
  title: string;
  description: string;
  commands: Cmd[];
};

const GROUPS: Group[] = [
  {
    title: 'Torneos',
    description: 'Crear, listar y gestionar torneos.',
    commands: [
      {
        name: '/tournament create',
        desc: 'Crea un torneo nuevo. Postea el embed con botones de registro en el canal donde lo ejecutás.',
        options: [
          { name: 'name', type: 'string', required: true, desc: 'Nombre del torneo (máx 80 chars)' },
          {
            name: 'format',
            type: 'choice',
            required: true,
            desc: 'Formato del bracket',
            values: ['Eliminación simple', 'Doble eliminación', 'Round robin (todos contra todos)'],
          },
          { name: 'max-participants', type: 'int 2-256', desc: 'Cupo máximo (default 32)' },
          { name: 'best-of', type: 'int 1-11', desc: 'Mejor de N (default 1)' },
          { name: 'description', type: 'string', desc: 'Descripción opcional (máx 500)' },
          {
            name: 'seeding',
            type: 'choice',
            desc: 'Cómo emparejar (default Aleatorio)',
            values: ['Aleatorio', 'Por orden de registro'],
          },
          {
            name: 'team-size',
            type: 'int 1-5',
            desc: 'Tamaño de equipo. 1=solo, 2=2v2, 3=3v3, etc',
          },
        ],
        examples: [
          '/tournament create name:Copa Mayo format:Eliminación simple max-participants:8',
          '/tournament create name:Liga 2v2 format:Doble eliminación max-participants:8 team-size:2',
          '/tournament create name:Pruebas RR format:Round robin max-participants:6',
        ],
        notes:
          'Doble eliminación necesita potencia de 2 participantes (2, 4, 8, 16, 32, 64, 128). Round robin acepta cualquier número ≥ 2.',
      },
      {
        name: '/tournament list',
        desc: 'Lista los torneos activos del server (excluye COMPLETED).',
        examples: ['/tournament list'],
      },
      {
        name: '/tournament view',
        desc: 'Muestra detalle de un torneo: cupo, participantes con seed, estado.',
        options: [{ name: 'name', type: 'string', required: true, desc: 'Slug del torneo' }],
        examples: ['/tournament view name:copa-mayo'],
      },
      {
        name: '/tournament start',
        desc:
          'Cierra registro y arranca el torneo. Genera el bracket, crea categoría + VCs por match de ronda 1, ' +
          'auto-mueve participantes que ya estén en voice, manda DM con info a cada uno.',
        options: [{ name: 'name', type: 'string', required: true, desc: 'Slug del torneo' }],
        examples: ['/tournament start name:copa-mayo'],
        notes:
          'Para teams (team-size > 1): valida que todos los equipos estén completos antes de iniciar.',
      },
      {
        name: '/tournament cancel',
        desc: 'Cancela el torneo. Borra la categoría y todos los VCs que el bot creó.',
        options: [{ name: 'name', type: 'string', required: true, desc: 'Slug del torneo' }],
        examples: ['/tournament cancel name:copa-mayo'],
      },
      {
        name: '/tournament checkin-open',
        desc:
          'Abre ventana de check-in con timer. Los participantes deben apretar "Check-in" en el embed antes que cierre. ' +
          'Los que no, son descartados automáticamente al cerrar.',
        options: [
          { name: 'name', type: 'string', required: true, desc: 'Slug del torneo' },
          { name: 'minutes', type: 'int 1-60', desc: 'Duración (default 5)' },
        ],
        examples: ['/tournament checkin-open name:copa-mayo minutes:10'],
        notes: 'Si el bot se reinicia antes que termine el timer, cerralo manualmente con `/tournament checkin-close`.',
      },
      {
        name: '/tournament checkin-close',
        desc: 'Cierra check-in manualmente y descarta a los no-show.',
        options: [{ name: 'name', type: 'string', required: true, desc: 'Slug del torneo' }],
        examples: ['/tournament checkin-close name:copa-mayo'],
      },
    ],
  },
  {
    title: 'Matches',
    description: 'Reportar resultados y panel admin.',
    commands: [
      {
        name: '/match report',
        desc:
          'Reportá el resultado de tu match. Necesita confirmación cruzada: ambos jugadores deben reportar y coincidir. ' +
          'Si discrepan, el match queda DISPUTED y un admin lo resuelve.',
        options: [
          { name: 'tournament', type: 'string', required: true, desc: 'Slug del torneo' },
          { name: 'result', type: 'choice', required: true, desc: 'Resultado', values: ['Gané', 'Perdí'] },
          { name: 'vs', type: 'user', desc: 'Oponente (solo si tenés varios matches abiertos, ej. round-robin)' },
          { name: 'my-score', type: 'int', desc: 'Tu score (opcional)' },
          { name: 'opp-score', type: 'int', desc: 'Score del rival (opcional)' },
        ],
        examples: [
          '/match report tournament:copa-mayo result:Gané',
          '/match report tournament:copa-mayo result:Perdí my-score:1 opp-score:2',
          '/match report tournament:liga-rr result:Gané vs:@usuario',
        ],
      },
      {
        name: '/match panel',
        desc:
          'Panel admin con botones para marcar ganador de matches READY y resolver DISPUTED. ' +
          'Muestra lista de participantes y estado del torneo.',
        options: [{ name: 'tournament', type: 'string', required: true, desc: 'Slug del torneo' }],
        examples: ['/match panel tournament:copa-mayo'],
        adminOnly: true,
        notes: 'Requiere permiso Manage Events o estar en ADMIN_DISCORD_IDS.',
      },
    ],
  },
  {
    title: 'Leaderboard',
    description: 'Ranking acumulado del server.',
    commands: [
      {
        name: '/leaderboard view',
        desc: 'Top del server: torneos ganados, W/L, puntos. Se actualiza solo cuando termina un torneo.',
        options: [{ name: 'limit', type: 'int 1-25', desc: 'Cuántos mostrar (default 10)' }],
        examples: ['/leaderboard view', '/leaderboard view limit:25'],
        notes:
          'Sistema de puntos: 10 por torneo ganado · 3 por victoria · 1 por participar. ' +
          'También disponible en web: https://tournify.josbert.dev/leaderboard/<guildId>',
      },
    ],
  },
  {
    title: 'Dev / Admin',
    description: 'Solo para admins (ADMIN_DISCORD_IDS). Útil para testear.',
    commands: [
      {
        name: '/dev seed-participants',
        desc: 'Genera N participantes fake en un torneo (útil para testear brackets sin invitar gente).',
        options: [
          { name: 'tournament', type: 'string', required: true, desc: 'Slug del torneo' },
          { name: 'count', type: 'int 1-32', required: true, desc: 'Cantidad de fakes' },
        ],
        examples: ['/dev seed-participants tournament:test count:8'],
        adminOnly: true,
      },
      {
        name: '/dev cleanup',
        desc: 'Borra todos los participantes fake (discord_id `dev_*`) de los torneos del server.',
        examples: ['/dev cleanup'],
        adminOnly: true,
      },
      {
        name: '/dev wipe-fake-users',
        desc: 'Borra TODOS los usuarios fake de la DB. Cuidado.',
        examples: ['/dev wipe-fake-users'],
        adminOnly: true,
      },
      {
        name: '/dev simulate-match',
        desc: 'Cierra el próximo match READY con ganador random. Útil para avanzar bracket en testing.',
        options: [{ name: 'tournament', type: 'string', required: true, desc: 'Slug' }],
        examples: ['/dev simulate-match tournament:test'],
        adminOnly: true,
      },
      {
        name: '/dev simulate-all',
        desc: 'Simula todos los matches restantes con ganadores random hasta terminar el torneo.',
        options: [{ name: 'tournament', type: 'string', required: true, desc: 'Slug' }],
        examples: ['/dev simulate-all tournament:test'],
        adminOnly: true,
      },
      {
        name: '/dev win-seed',
        desc: 'El participante con seed N gana SU próximo match READY. Control fino para testear bracket específicos.',
        options: [
          { name: 'tournament', type: 'string', required: true, desc: 'Slug' },
          { name: 'seed', type: 'int', required: true, desc: 'Seed del ganador' },
        ],
        examples: [
          '/dev win-seed tournament:test seed:1   ← seed 1 gana',
          '/dev win-seed tournament:test seed:8   ← upset: seed 8 le gana al 1',
        ],
        adminOnly: true,
      },
    ],
  },
  {
    title: 'Otros',
    description: '',
    commands: [
      {
        name: '/ping',
        desc: 'Devuelve latencia del bot al gateway de Discord. Sanity check.',
        examples: ['/ping'],
      },
    ],
  },
];

export default function ComandosPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 border-b-2 border-border-strong pb-6">
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [comandos]
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-tight md:text-5xl">
          Slash commands
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Todos los comandos disponibles en Discord. Los marcados como <span className="text-warning font-bold">[admin]</span>{' '}
          requieren estar en <code className="text-foreground">ADMIN_DISCORD_IDS</code> o tener permiso Manage Events.
        </p>
      </header>

      <nav className="mb-10 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <a
            key={g.title}
            href={`#${slug(g.title)}`}
            className="border-2 border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
          >
            {g.title}
          </a>
        ))}
      </nav>

      {GROUPS.map((group) => (
        <section key={group.title} id={slug(group.title)} className="mb-12">
          <div className="mb-2 border-b-2 border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              {group.title}
            </h2>
            {group.description && (
              <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>

          <div className="space-y-6">
            {group.commands.map((cmd) => (
              <article
                key={cmd.name}
                className="border-2 border-border bg-card p-5"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold tabular-nums">{cmd.name}</h3>
                  {cmd.adminOnly && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-warning">
                      [admin]
                    </span>
                  )}
                </div>
                <p className="mb-4 text-sm text-muted-foreground">{cmd.desc}</p>

                {cmd.options && cmd.options.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Opciones
                    </div>
                    <div className="overflow-x-auto border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted text-muted-foreground">
                            <th className="px-2 py-1 text-left">Opción</th>
                            <th className="px-2 py-1 text-left">Tipo</th>
                            <th className="px-2 py-1 text-left">Descripción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cmd.options.map((opt) => (
                            <tr key={opt.name} className="border-b border-border last:border-b-0">
                              <td className="px-2 py-1 font-bold">
                                {opt.name}
                                {opt.required && <span className="text-danger">*</span>}
                              </td>
                              <td className="px-2 py-1 text-muted-foreground">{opt.type}</td>
                              <td className="px-2 py-1">
                                {opt.desc}
                                {opt.values && (
                                  <div className="mt-1 text-muted-foreground">
                                    {opt.values.map((v) => (
                                      <code key={v} className="mr-1 text-[10px]">
                                        {v}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Ejemplos
                </div>
                <div className="space-y-1">
                  {cmd.examples.map((ex) => (
                    <pre
                      key={ex}
                      className="overflow-x-auto border border-border bg-muted px-3 py-2 text-xs"
                    >
                      <code>{ex}</code>
                    </pre>
                  ))}
                </div>

                {cmd.notes && (
                  <p className="mt-3 border-l-2 border-warning pl-3 text-xs text-muted-foreground">
                    {cmd.notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-12 border-t-2 border-border-strong pt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        [tournify.josbert.dev/comandos] · <span className="text-danger">*</span> = requerido
      </footer>
    </main>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
