import type { Metadata } from 'next';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, Cancel01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { auth } from '@/auth';
import { getFeed, getProfileSummary } from '@/lib/community';
import {
  getActiveSeason,
  getSeasonLeaderboard,
  getAllTimeLeaderboard,
  getUserStanding,
} from '@/lib/season';
import { isR2Configured, r2MissingVars } from '@/lib/r2';
import { listWeapons } from '@/lib/wz-data';
import { Composer, type WeaponOption } from './composer';
import { Feed } from './feed';
import { LoginProvider } from './login-gate';
import { IdentityCard } from './identity-card';
import { RankingRail } from './ranking-rail';
import { SeasonBanner } from './season-banner';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Comunidad — Tournify',
  description:
    'Feed de la comunidad: subí tus mejores plays, reaccioná y comentá las de los demás.',
};

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ arma?: string }>;
}) {
  const { arma } = await searchParams;
  const session = await auth();

  const [{ posts, nextCursor }, profile, season] = await Promise.all([
    getFeed(session, { weaponId: arma }),
    getProfileSummary(session),
    getActiveSeason(),
  ]);

  const leaderboard = season
    ? await getSeasonLeaderboard(season, 10)
    : await getAllTimeLeaderboard(10);
  const leader = leaderboard[0] ?? null;
  const standing =
    season && session?.user?.id ? await getUserStanding(session.user.id, season) : null;

  const weapons: WeaponOption[] = listWeapons('warzone')
    .map((w) => ({ id: w.id, name: w.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeWeapon = arma ? weapons.find((w) => w.id === arma) : undefined;

  const isAuthed = !!session?.user?.id;
  const r2Ready = isR2Configured();
  const r2Reason = `Faltan credenciales de R2 en el .env: ${r2MissingVars().join(', ')}.`;

  return (
    <LoginProvider>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
          {/* Sidebar izquierdo — perfil */}
          <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
            <IdentityCard profile={profile} />
          </aside>

          {/* Columna central — feed */}
          <div className="min-w-0">
            {season && (
              <SeasonBanner
                season={season}
                leader={leader}
                standing={standing}
                isAuthed={isAuthed}
              />
            )}

            <header className="mb-6 border-b border-border pb-4">
              <div className="mb-2 flex items-center gap-2 tag-tactical">
                <HugeiconsIcon icon={UserGroupIcon} className="h-3.5 w-3.5" />
                <span>// COMUNIDAD</span>
              </div>
              <h1 className="stencil text-4xl md:text-5xl">Feed de plays</h1>
              <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                Subí tus mejores jugadas · reaccioná · comentá
              </p>
            </header>

            {activeWeapon && (
              <div className="mb-6 flex items-center justify-between gap-4 border-l-2 border-primary bg-card px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Filtrando por <span className="text-primary">{activeWeapon.name}</span>
                </span>
                <Link
                  href="/comunidad"
                  className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                  Quitar
                </Link>
              </div>
            )}

            <Composer
              isAuthed={isAuthed}
              r2Ready={r2Ready}
              disabledReason={r2Reason}
            />

            <Feed
              initialPosts={posts}
              initialCursor={nextCursor}
              weaponId={arma}
              isAuthed={isAuthed}
            />
          </div>

          {/* Sidebar derecho — ranking + reglas */}
          <aside className="hidden space-y-4 self-start lg:sticky lg:top-24 lg:block">
            <RankingRail rows={leaderboard} seasonName={season?.name} />

            <div className="hud-panel p-4">
              <div className="mb-3 flex items-center gap-2 tag-tactical">
                <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5" />
                <span>// REGLAS DE COMBATE</span>
              </div>
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li>Clips en MP4, WEBM o MOV — hasta 100 MB.</li>
                <li>Sumá likes en tus clips para escalar en el ranking.</li>
                <li>Nada de toxicidad: los mensajes pasan por filtro.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </LoginProvider>
  );
}
