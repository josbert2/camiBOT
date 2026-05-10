# camiBOT

Bot de Discord para hostear torneos (estilo [Tourney Bot](https://tourneybot.gg/)) + dashboard web brutalist dark.

## Stack

- **Monorepo**: pnpm workspaces + turborepo
- **Bot** (`apps/bot`): Node 20 + discord.js v14 + TypeScript
- **Web** (`apps/web`): Next.js 16 + Tailwind v4 + Auth.js v5 (Discord OAuth)
- **DB** (`packages/db`): Postgres 16 + Prisma 6
- **Engine de brackets** (`packages/core`): single elim listo, double elim + round robin en Fase 3
- **Tipos compartidos** (`packages/types`)
- **Cola/cache**: Redis 7 + BullMQ
- **Deploy**: VPS con Docker Compose + Caddy

## Setup local

```bash
# 1. Instalar deps
pnpm install

# 2. Copiar env
cp .env.example .env
# Editar .env con: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, AUTH_SECRET

# 3. Levantar Postgres + Redis (puertos 5435 y 6383)
pnpm docker:up

# 4. Generar cliente Prisma + migrar
pnpm db:generate
pnpm db:migrate

# 5. Dev (bot + web en paralelo)
pnpm dev
```

### Solo web

```bash
pnpm --filter @camibot/web dev
# http://localhost:3001
```

### Solo bot

```bash
pnpm --filter @camibot/bot dev
```

### Registrar slash commands en un guild de dev (instantáneo)

```bash
pnpm --filter @camibot/bot register -- --guild=TU_GUILD_ID
```

## Estructura

```
camibot/
├── apps/
│   ├── bot/         # Bot Discord
│   └── web/         # Dashboard + landing (brutalist dark)
├── packages/
│   ├── db/          # Prisma schema + client
│   ├── core/        # Engine de brackets + render
│   └── types/       # Tipos compartidos
├── docker-compose.yml
└── turbo.json
```

## Slash commands disponibles

- `/ping` — verifica que el bot responde
- `/tournament create name:<str> format:<single-elim|...> [max-participants] [best-of] [description]`
- `/tournament list` — listar torneos activos del server
- `/tournament start name:<slug>` — cierra registro y genera bracket
- `/tournament cancel name:<slug>` — cancela un torneo
- `/match report tournament:<slug> result:<gane|perdi> [my-score] [opp-score]` — reportar match

Botones automáticos en el embed de registro: **Registrarse** / **Salirse** / **Check-in**.

## Roadmap

- [x] **Fase 0**: Setup monorepo, schema, shells de bot/web, Auth.js Discord
- [x] **Fase 1**: Bot MVP — single elim, registro con botones, check-in, bracket auto-avance
- [ ] **Fase 2**: Web visualizer — bracket SVG, OAuth, listado por guild
- [ ] **Fase 3**: Double elim + round robin + leaderboards + multi-game
- [ ] **Fase 4**: Stripe premium + tournament discovery cross-server
- [ ] **Fase 5**: Landing pública + deploy VPS

## Configurar la app de Discord

1. https://discord.com/developers/applications → **New Application**
2. Bot tab → **Reset Token** → copiar a `DISCORD_TOKEN`
3. OAuth2 tab → copiar **Client ID** y **Client Secret**
4. OAuth2 → URL Generator → scopes: `bot` + `applications.commands` + `identify` + `email` + `guilds`
5. Bot permissions: `Manage Events`, `Send Messages`, `Embed Links`, `Manage Threads`
6. Settings → **Public Bot** OFF mientras sea dev

## Tests

```bash
pnpm --filter @camibot/core test  # 23 tests del engine de brackets
```
