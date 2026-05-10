import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            [dashboard]
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase">
            {session.user.name ?? 'admin'}
          </h1>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="border-2 border-border-strong bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-danger hover:text-danger-foreground"
          >
            Salir
          </button>
        </form>
      </div>

      <div className="grid gap-px border-2 border-border bg-border md:grid-cols-3">
        {[
          { k: 'TOURNAMENTS', v: '0', s: 'activos' },
          { k: 'PARTICIPANTS', v: '0', s: 'totales' },
          { k: 'GUILDS', v: '0', s: 'conectados' },
        ].map((stat) => (
          <div key={stat.k} className="bg-card p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {stat.k}
            </div>
            <div className="mt-2 text-4xl font-bold">{stat.v}</div>
            <div className="text-xs uppercase text-muted-foreground">{stat.s}</div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        // Vista vacía. Se llena en Fase 2 cuando exista el bot creando torneos.
      </p>
    </main>
  );
}
