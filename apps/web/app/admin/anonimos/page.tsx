import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

function fmt(d: Date): string {
  return new Date(d).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AnonimosAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session)) redirect('/admin');

  const posts = await prisma.post.findMany({
    where: { anonymous: true, status: 'PUBLISHED', removedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      kind: true,
      caption: true,
      createdAt: true,
      author: { select: { username: true, globalName: true, nickname: true, discordId: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            [admin / moderación]
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase">Posts anónimos</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Autor real de cada post anónimo (solo visible para admins).
          </p>
        </div>
        <Link
          href="/admin"
          className="border-2 border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
        >
          ← Admin
        </Link>
      </header>

      {posts.length === 0 ? (
        <div className="border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          No hay posts anónimos.
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2 text-left">Cuándo</th>
                <th className="px-3 py-2 text-left">Autor real</th>
                <th className="px-3 py-2 text-left">Discord ID</th>
                <th className="px-3 py-2 text-left">Post</th>
                <th className="px-3 py-2 text-right">Ver</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {fmt(p.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs font-bold">
                    {p.author.nickname ?? p.author.globalName ?? p.author.username}
                    <span className="ml-1 font-normal text-muted-foreground">
                      @{p.author.username}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {p.author.discordId}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs">
                    <span className="text-[10px] uppercase text-muted-foreground">[{p.kind}]</span>{' '}
                    {p.caption ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/c/${p.id}`} className="text-primary hover:underline">
                      abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
