import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@camibot/db';
import { getRequestIpHash } from '@/lib/ip';
import { ClansBoard, type ClanRow } from './board';
import { CneBanner } from './cne-banner';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.AUTH_URL ?? 'https://tournify.josbert.dev';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const metadata: Metadata = {
  title: 'Nombres de Clan Warzone · Votación de la comunidad',
  description:
    'Registrá tu propuesta de nombre de clan de Warzone y votá por la favorita. Una IP, un nombre cada 24h, un voto.',
  alternates: { canonical: '/wz/clans' },
  keywords: [
    'nombres de clan warzone',
    'mejor nombre de clan',
    'clan warzone',
    'votar nombre clan',
    'crew warzone',
    'apodos call of duty',
  ],
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/wz/clans`,
    title: 'Nombres de Clan Warzone · Votá el favorito de la comunidad',
    description: 'Propuestas abiertas. Una IP, un voto. Cooldown 24h.',
  },
};

export default async function ClansPage() {
  const ipHash = await getRequestIpHash();

  const [clansRaw, myVotes, lastRegister] = await Promise.all([
    prisma.clanName.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { votes: true } },
      },
      orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'asc' }],
      take: 200,
    }),
    prisma.clanVote.findMany({
      where: { ipHash },
      select: { clanNameId: true },
    }),
    prisma.clanName.findFirst({
      where: { ipHash },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const clans: ClanRow[] = clansRaw.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    votes: c._count.votes,
    createdAt: c.createdAt.toISOString(),
  }));

  const registerUnlockAt = lastRegister
    ? new Date(lastRegister.createdAt.getTime() + COOLDOWN_MS).toISOString()
    : null;

  const totalVotes = clans.reduce((acc, c) => acc + c.votes, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 border-b-2 border-border pb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <Link href="/wz" className="hover:text-foreground">WZ Meta</Link>
          <span>/</span>
          <span className="text-foreground">Nombres de Clan</span>
        </div>
        <h1 className="display mt-1 text-5xl uppercase">Clan Names · WZ</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Proponé un nombre de clan. La comunidad vota. Una IP registra un nombre cada 24h y elige
          un favorito (cambiable cada 24h). Sin login.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="stat-block px-3 py-2">
            <span className="block text-muted-foreground">Propuestas</span>
            <span className="text-foreground font-bold">{clans.length}</span>
          </span>
          <span className="stat-block px-3 py-2">
            <span className="block text-muted-foreground">Votos totales</span>
            <span className="text-foreground font-bold">{totalVotes}</span>
          </span>
        </div>
      </header>

      <CneBanner clans={clans} />

      <ClansBoard
        initialClans={clans}
        initialMyVoteIds={myVotes.map((v) => v.clanNameId)}
        initialRegisterUnlockAt={registerUnlockAt}
      />
    </main>
  );
}
