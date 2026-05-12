# wzstats-mini

Scraper completo de wzstats.gg con frontend de catálogo para BO7.

## Quick start

```bash
# Scrape completo (5 targets, español, ~95s)
node scraper.mjs

# Solo BO7 multiplayer
node scraper.mjs --game bo7 --mode multiplayer

# Multi-idioma
node scraper.mjs --lang es,en

# Rápido (sin attachments por arma)
node scraper.mjs --skip-attachments --skip-details

# Ver targets disponibles
node scraper.mjs --list

# Servir el catalog
python3 -m http.server 4321
# → http://localhost:4321/catalog.html
```

## Targets

| game    | mode        | armas |
|---------|-------------|-------|
| bo7     | multiplayer | 50    |
| bo7     | ranked      | 50    |
| bo6     | multiplayer | 119   |
| bo6     | ranked      | 119   |
| warzone | warzone     | 257   |

Total: 595 armas.

## Endpoints consumidos

1. `/wz2/weapons/meta/weapons-and-tier-lists/` — lista + tier list oficial
2. `/wz2/weapons/builds/wzstats/with-attachments/` — builds curados
3. `/wz2/weapons/loadouts/full` — loadouts con perks + specialist + equipo
4. `/warzone/weapons/attachments/all-attachments-for-weapon/` — todos los attachments con unlockLevel/Pase/Prestigio
5. `/v3/weapon/more-information/pros-cons/`
6. `/v3/weapon/more-information/best-perks/`
7. `/v3/weapon/more-information/equipments/`
8. `/v3/weapon/more-information/best-alternatives/`
9. `/v3/weapon/more-information/best-to-pair-with/`
10. `/wz2/articles/?tags[]=...` — rankings por categoría (Largo Alcance / Corto Alcance / etc)
11. `/season/{game}` — versiones
12. (opcional `--browser`) orden visual scrapeado del HTML

## Output

```
dumps/
├── _meta/
│   ├── seasons.json          ← versiones por juego
│   └── last-run.json         ← resumen del último run
├── bo7/
│   ├── multiplayer-es.json
│   └── ranked-es.json
├── bo6/
│   ├── multiplayer-es.json
│   └── ranked-es.json
└── warzone/
    └── warzone-es.json

logs/
├── history.jsonl             ← una línea JSON por run
└── scraper-YYYYMMDD.log
```

Cada `*.json` tiene shape:

```json
{
  "meta": { "scraper", "version", "game", "gamemode", "language", "generatedAt", "durationMs", "stages": {...} },
  "counts": { "weapons", "builds", "categories", "withBadges" },
  "tierList": { "META": [...], "A": [...], "B": [...], "C": [...], "D": [...] },
  "categoryArticles": { "long-range": { "label", "season", "weapons": [...] }, ... },
  "loadoutsFull": { "loadouts": [...], "weapons": [...], "builds": [...] },
  "weapons": [
    {
      "id", "name", "type", "tier", "isNew", "weaponCode", "imageVersion",
      "tier",
      "images": { "thumb", "full" },
      "badges": [{ "rank", "category", "tag" }],
      "builds": [...],
      "details": { "alts", "pair", "prosCons", "perks", "equip", "attachments" }
    }
  ]
}
```

## Diff

Cada run compara contra el dump anterior y reporta:
- `+` agregadas
- `−` borradas
- `Δ` cambiadas (tier, isNew, builds count o badges count)

## Cron

```bash
# Diario a las 5am
0 5 * * *  /home/jos/root/josbert.dev/wzstats-mini/cron.sh
```

`cron.sh` rota logs > 14 días.

## CLI flags

| flag                    | descripción |
|-------------------------|-------------|
| `--game <bo7\|bo6\|warzone\|all>`  | filtrar juego |
| `--mode <multiplayer\|ranked\|warzone>` | filtrar modo |
| `--lang es,en`          | uno o más idiomas |
| `--skip-details`        | sin pros/cons/perks por arma |
| `--skip-builds`         | sin builds curados ni loadouts |
| `--skip-articles`       | sin rankings por categoría |
| `--skip-attachments`    | sin attachments por arma |
| `--browser`             | scrape orden visual con Playwright |
| `--dry-run`             | no escribe archivos |
| `--quiet`               | menos logs |
| `--list`                | listar targets |
| `--help`                | ayuda |
