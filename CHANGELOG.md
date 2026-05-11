# Changelog

## [Unreleased]

### Fase 1.5 — Voice channels + random seeding + bracket SVG público (2026-05-10)

#### Bot
- **Random seeding** por default en `/tournament start` (Fisher-Yates). Opción `seeding:` en `/tournament create` (`RANDOM` o `REGISTRATION`).
- **Voice channels automáticos** en `/tournament start`:
  - Crea categoría `🏆 NombreDelTorneo`
  - Crea un VC por match de ronda 1 (`QF: A vs B`, etc), con `userLimit: 4`
  - **Auto-mueve** participantes que ya están en algún VC del server
  - Menciona con `<#channelId>` a los que no están en voice
  - Persiste `voiceCategoryId` en Tournament y `voiceChannelId` en Match
- **Auto-VC en advance**: `/match report` crea el VC del próximo match cuando este queda READY y mueve al ganador si está en voice.
- **Cleanup de VCs** en `/tournament cancel`: borra la categoría y todos los VCs adentro.
- **`/tournament view name:<slug>`** — muestra detalle del torneo con participantes en mensaje ephemeral.
- **`/dev seed-participants | cleanup | wipe-fake-users`** — comandos solo-dev para testear brackets sin invitar gente. Guardarrail `NODE_ENV !== production`.
- Embed de registro ahora **lista a los participantes** (no solo el contador).
- Fix: intent `GuildMembers` era privileged y bloqueaba el login. Reducido a `Guilds` (suficiente para slash commands + botones).
- Fix: `/ping` simplificado para evitar API nueva `withResponse`.

#### Web
- **Página pública `/t/[id]`** con bracket SVG brutalist:
  - Header con estado, ganador (si COMPLETED), descripción
  - Stats grid (formato, participantes, BO, matches completos)
  - **`<BracketSVG>`**: layout horizontal, boxes 220x72 con borde 2px, conectores L-shape, accent verde (COMPLETED) / blurple (READY) / gris (PENDING), winner row con fondo blurple translúcido + negrita, score visible solo si COMPLETED
  - Grid de participantes con seed numerado y W/L
- Title global: "camiBOT — Discord tournaments"
- Symlink `apps/web/.env → ../../.env` para que Next.js cargue el env del monorepo root.

#### Auth.js
- **Split de config para Edge Runtime**:
  - `auth.config.ts` — config base (provider Discord, callbacks) sin PrismaAdapter, edge-safe
  - `auth.ts` — full config con PrismaAdapter, para server actions / route handlers
  - `middleware.ts` — usa solo `auth.config.ts` (Edge), no toca Prisma
- Fix: `node:url` y `node:path` en `packages/db` rompían Edge — removidos.

#### DB
- Migration `add_voice_channels_and_seeding`:
  - `Tournament.voiceCategoryId String?`
  - `Tournament.seedingMode SeedingMode @default(RANDOM)`
  - `Match.voiceChannelId String?`
  - Nuevo enum `SeedingMode { RANDOM, REGISTRATION, MANUAL }`
- `packages/db/src/index.ts` ahora es edge-compatible (sin Node APIs).

---

### Fase 1 — Bot MVP single elim (2026-05-10)

- **Engine de brackets** en `packages/core`:
  - `generateSingleElim({ seeds })` con seeding NCAA-standard
  - `standardSeeding(size)` para potencias de 2
  - Maneja byes (pad hasta próxima potencia de 2, top seed avanza automático)
  - `applyMatchResult(matches, matchId, winnerId)` para advance
  - `renderBracketText(matches, opts)` para embeds Discord
  - 23 tests con vitest (seeding + single-elim + advance)
- **Comandos**: `/ping`, `/tournament create | list | start | cancel`, `/match report`
- **Botones**: register / unregister / check-in en el embed del torneo
- **Helpers de DB**: `upsertGuild`, `upsertUser`, `slugify`, `uniqueTournamentSlug`
- **Embeds**: `tournamentRegistrationEmbed`, `bracketEmbed`
- **Logging**: pino + pino-pretty en dev
- **Env validation** con zod (`apps/bot/src/lib/env.ts`)
- **Script de registro de slash commands** con flag `--guild=ID` para dev rápido

### Fase 0 — Setup monorepo (2026-05-10)

- Monorepo pnpm workspaces + turborepo
- 5 workspaces: `apps/bot`, `apps/web`, `packages/db`, `packages/core`, `packages/types`
- Prisma schema completo (10 modelos: User, Guild, GuildMember, Game, Tournament, Participant, Match, MatchReport, Leaderboard, LeaderboardEntry, Subscription)
- Next.js 16 shell con Tailwind v4 + Auth.js v5 + brutalist dark tokens
- docker-compose con Postgres 16 + Redis 7 (puertos 5435/6383)
- TypeScript estricto, ESM en todo el monorepo
- README + CHANGELOG + .gitignore + .nvmrc + .prettierrc
- Puertos reservados para no chocar con otros proyectos: Postgres 5435, Redis 6383, Next 3001
