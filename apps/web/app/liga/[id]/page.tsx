import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon } from '@hugeicons/core-free-icons';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getLeague, computeStandings } from '@/lib/league';
import { discordAvatarUrl } from '@/lib/community';
import { LeagueFixtures, type FixtureMatch } from './fixtures';
import { LeagueAdmin } from './league-admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Liga — Tournify' };

function nameOf(u: { nickname: string | null; globalName: string | null; username: string }): string {
  return u.nickname ?? u.globalName ?? u.username;
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();

  const session = await auth();
  const standings = computeStandings(league.players, league.matches);

  const fixtures: FixtureMatch[] = league.matches.map((m) => ({
    id: m.id,
    homeName: nameOf(m.home.user),
    awayName: nameOf(m.away.user),
    homeAvatar: discordAvatarUrl(m.home.user.discordId, m.home.user.avatar),
    awayAvatar: discordAvatarUrl(m.away.user.discordId, m.away.user.avatar),
    homeUserId: m.home.userId,
    awayUserId: m.away.userId,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeKills: m.homeKills,
    awayKills: m.awayKills,
    status: m.status,
  }));

  const played = fixtures.filter((f) => f.status === 'PLAYED').length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <header className="mb-8 border-b border-border pb-4">
        <div className="mb-2 flex items-center gap-2 tag-tactical">
          <HugeiconsIcon icon={ChampionIcon} className="h-3.5 w-3.5" />
          <span>// LIGA {league.status === 'FINISHED' ? '· FINALIZADA' : ''}</span>
        </div>
        <h1 className="stencil text-4xl md:text-5xl">{league.name}</h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          {league.players.length} jugadores · {played}/{fixtures.length} partidos jugados · puntos 3/1/0
        </p>
      </header>

      {isAdmin(session) && <LeagueAdmin leagueId={league.id} status={league.status} />}

      <section className="mb-10">
        <div className="mb-3 tag-tactical">// TABLA DE POSICIONES</div>
        <div className="overflow-x-auto border-2 border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Jugador</th>
                <th className="px-2 py-2 text-right">PJ</th>
                <th className="px-2 py-2 text-right">PG</th>
                <th className="px-2 py-2 text-right">PE</th>
                <th className="px-2 py-2 text-right">PP</th>
                <th className="px-2 py-2 text-right">DG</th>
                <th className="px-2 py-2 text-right text-danger">Kills</th>
                <th className="px-2 py-2 text-right text-primary">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => (
                <tr key={r.playerId} className={`border-b border-border last:border-b-0 ${i === 0 ? 'bg-primary/10' : ''}`}>
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2">
                      {r.avatarUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatarUrl} alt="" className="h-6 w-6 border border-border object-cover" />
                      )}
                      <span className="truncate font-bold">{r.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.pj}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-success">{r.pg}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.pe}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-danger">{r.pp}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-danger">{r.kills}</td>
                  <td className="display px-2 py-2 text-right text-lg tabular-nums text-primary">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {standings.some((r) => r.kills > 0) && (
        <section className="mb-10">
          <div className="mb-3 tag-tactical">// KILLS</div>
          <ol className="divide-y divide-border border-2 border-border">
            {[...standings]
              .sort((a, b) => b.kills - a.kills)
              .slice(0, 10)
              .map((r, i) => (
                <li key={r.playerId} className="flex items-center gap-3 px-3 py-2">
                  <span className="display w-5 text-center text-base text-muted-foreground">
                    {i + 1}
                  </span>
                  {r.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-7 w-7 border border-border object-cover" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                  <span className="display text-lg tabular-nums text-danger">{r.kills}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">kills</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      <section>
        <div className="mb-3 tag-tactical">// PARTIDOS</div>
        <LeagueFixtures
          leagueId={league.id}
          matches={fixtures}
          isAdmin={isAdmin(session)}
          myUserId={session?.user?.id ?? null}
        />
      </section>
    </main>
  );
}
