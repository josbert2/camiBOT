# camiBOT

Bot de Discord para hostear torneos (inspirado en [Tourney Bot](https://tourneybot.gg/)) + dashboard web brutalist dark con visualizador SVG de brackets.

## Features (estado actual)

- Slash commands para crear y gestionar torneos (`/tournament create | list | view | start | cancel`)
- Registro con botones (Registrarse / Salirse / Check-in)
- Single elimination con seeding **aleatorio** (Fisher-Yates) o por orden de registro
- Reporte de matches (`/match report`) con auto-avance del bracket
- **Voice channels automáticos**: el bot crea una categoría con un VC por match, te mueve si ya estás en voice, te menciona con el link si no
- Página pública con bracket SVG brutalist en `/t/<tournament-id>`
- Comandos `/dev seed-participants | cleanup | wipe-fake-users` para testing sin invitar gente real

Pendiente:
- Auth.js Discord OAuth funcional (dashboard `/dashboard`)
- Double elimination + round robin
- Leaderboards persistentes
- Multi-game
- Stripe premium
- Tournament discovery cross-server
- Landing pública + deploy a VPS

## Stack

- **Monorepo**: pnpm workspaces + turborepo
- **Bot** (`apps/bot`): Node 20 + discord.js v14 + TypeScript + tsx (dev) + tsup (build) + pino logging
- **Web** (`apps/web`): Next.js 16 (App Router, Turbopack) + Tailwind v4 + Auth.js v5 (Discord OAuth) + Geist Mono
- **DB** (`packages/db`): Postgres 16 + Prisma 6
- **Engine de brackets** (`packages/core`): single elim NCAA-style, byes, auto-advance (23 tests)
- **Tipos compartidos** (`packages/types`)
- **Cola/cache**: Redis 7 + BullMQ (para Fase 2+)
- **Deploy** (Fase 5): VPS con Docker Compose + Caddy

## Setup local

```bash
# 1. Instalar deps
pnpm install

# 2. Copiar env y configurar
cp .env.example .env
# Editar .env con: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
# DISCORD_PUBLIC_KEY, AUTH_SECRET (generar con `openssl rand -base64 32`)

# 3. Symlink .env para Next.js
ln -sf ../../.env apps/web/.env

# 4. Levantar Postgres + Redis (puertos 5435 y 6383)
pnpm docker:up

# 5. Generar cliente Prisma + migrar
pnpm db:generate
pnpm db:migrate

# 6. Dev (bot + web en paralelo)
pnpm dev
# Web: http://localhost:3001
```

### Solo web

```bash
pnpm --filter @camibot/web dev
```

### Solo bot

```bash
pnpm --filter @camibot/bot dev
```

### Registrar slash commands en un guild (instantáneo)

```bash
cd apps/bot
pnpm exec tsx src/scripts/register-commands.ts --guild=TU_GUILD_ID
```

Sin `--guild` registra globalmente (propaga ~1h).

## Estructura

```
camibot/
├── apps/
│   ├── bot/
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── ping.ts
│   │   │   │   ├── tournament/
│   │   │   │   ├── match/
│   │   │   │   └── dev/             # NODE_ENV !== production
│   │   │   ├── interactions/buttons/
│   │   │   ├── events/
│   │   │   ├── lib/
│   │   │   │   ├── env.ts
│   │   │   │   ├── voice.ts         # crear/borrar/mover VCs
│   │   │   │   ├── embeds.ts
│   │   │   │   ├── components.ts
│   │   │   │   └── db-helpers.ts
│   │   │   └── index.ts
│   │   └── scripts/register-commands.ts
│   └── web/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── login/
│       │   ├── dashboard/
│       │   ├── t/[id]/              # bracket viewer público
│       │   └── api/auth/[...nextauth]/
│       ├── components/bracket-svg.tsx
│       ├── auth.config.ts           # Edge-safe (middleware)
│       └── auth.ts                  # Full (PrismaAdapter)
├── packages/
│   ├── db/
│   ├── core/
│   └── types/
├── docker-compose.yml
└── turbo.json
```

## Slash commands

### `/ping`
Verifica que el bot responde. Devuelve latencia WS.

### `/tournament create`

| Opción | Tipo | Default |
|---|---|---|
| `name` (req) | string | — |
| `format` (req) | choice | — |
| `max-participants` | int 2-256 | 32 |
| `best-of` | int 1-11 | 1 |
| `description` | string | — |
| `seeding` | `RANDOM` \| `REGISTRATION` | `RANDOM` |

### `/tournament list`
Torneos activos del server.

### `/tournament view name:<slug>`
Detalle: stats + participantes con seeds.

### `/tournament start name:<slug>`
1. Aplica seeding (shuffle si RANDOM).
2. Genera el bracket + persiste matches.
3. Crea categoría `🏆 NombreDelTorneo`.
4. Crea un VC por match de ronda 1.
5. Auto-mueve participantes que ya están en voice.
6. Postea embed con bracket text + link a `/t/<id>`.

### `/tournament cancel name:<slug>`
CANCELLED + borra categoría y VCs.

### `/match report tournament:<slug> result:<WIN|LOSS>`
Marca match COMPLETED, avanza ganador. Si el próximo match queda con dos jugadores → crea su VC y mueve al ganador.

### `/dev seed-participants | cleanup | wipe-fake-users`
Solo en dev. Crea/borra participantes fake (`dev_N`) para testear brackets sin invitar gente.

## Voice channel behavior

Discord no permite "convocar" usuarios a voice — solo mover a alguien que **ya está en algún VC**:

| Estado del jugador | Acción |
|---|---|
| Ya en voice | Bot lo mueve al VC del match |
| Fuera de voice | Bot menciona con `<#channelId>`; entra manualmente |
| User fake | Ignorado |

Permisos del bot: `Manage Channels` + `Move Members`. Con `permissions=8` (admin) ambos están cubiertos.

## Página pública `/t/<id>`

Server-rendered. Lee directo de Postgres. Cualquiera con el link puede ver:
- Estado y ganador
- Stats grid
- **Bracket SVG brutalist**: boxes 2px, lines L-shape, accent verde (COMPLETED) / blurple (READY) / gris (PENDING)
- Grid de participantes con seed + W/L

El link se incluye en la respuesta de `/tournament start`.

## Puertos

| Servicio | Puerto |
|---|---|
| Postgres | 5435 |
| Redis | 6383 |
| Next.js dev | 3001 |

(Asignados para no chocar con otros proyectos del workspace.)

## Tests

```bash
pnpm --filter @camibot/core test
# 23 tests del engine de brackets
```

## Roadmap

- [x] **Fase 0**: Setup monorepo, schema, shells de bot/web
- [x] **Fase 1**: Bot MVP single elim
- [x] **Fase 1.5**: VCs por match con auto-move, seeding aleatorio, bracket SVG público
- [ ] **Fase 2**: Dashboard funcional — OAuth + listado por user, reseed manual
- [ ] **Fase 3**: Double elim + round robin + leaderboards + multi-game
- [ ] **Fase 4**: Stripe premium + discovery cross-server
- [ ] **Fase 5**: Landing pública + deploy VPS

## Configurar la app de Discord

1. https://discord.com/developers/applications → **New Application**
2. Bot tab → **Reset Token** → `DISCORD_TOKEN`
3. OAuth2 tab → **Client ID** + **Client Secret**
4. OAuth2 → URL Generator → scopes `bot` + `applications.commands` + `identify` + `email` + `guilds`
5. Permissions: `Administrator` (8) durante dev, o set mínimo:
   - View Channels, Send Messages, Embed Links, Add Reactions, Read Message History
   - Use Application Commands, Manage Events
   - Manage Channels (crear VCs)
   - Move Members (auto-move a VCs)

OAuth Redirects (Auth.js):
- `http://localhost:3001/api/auth/callback/discord` (dev)
- `https://<tu-dominio>/api/auth/callback/discord` (prod)
