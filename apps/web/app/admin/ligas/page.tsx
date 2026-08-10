import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { CreateLeague } from './create-league';

export const dynamic = 'force-dynamic';

function nameOf(u: { nickname: string | null; globalName: string | null; username: string }): string {
  return u.nickname ?? u.globalName ?? u.username;
}

export default async function AdminLigasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session)) redirect('/admin');

  const [users, leagues] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ participations: { some: {} } }, { posts: { some: {} } }] },
      select: { id: true, username: true, globalName: true, nickname: true },
      take: 200,
    }),
    prisma.league.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { players: true, matches: true } } },
    }),
  ]);

  const userOpts = users
    .map((u) => ({ id: u.id, name: nameOf(u) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">[admin / ligas]</div>
          <h1 className="mt-1 text-3xl font-bold uppercase">Ligas</h1>
        </div>
        <Link
          href="/admin"
          className="border-2 border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
        >
          ← Admin
        </Link>
      </header>

      <div className="mb-12">
        <CreateLeague users={userOpts} />
      </div>

      <section>
        <div className="mb-3 border-b-2 border-border pb-2 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Ligas creadas
        </div>
        {leagues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ligas.</p>
        ) : (
          <ul className="divide-y divide-border border-2 border-border">
            {leagues.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2">
                <Link href={`/liga/${l.id}`} className="font-bold hover:underline">
                  {l.name}
                </Link>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {l.status === 'ACTIVE' ? 'En curso' : 'Finalizada'} · {l._count.players} jug · {l._count.matches} part
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
