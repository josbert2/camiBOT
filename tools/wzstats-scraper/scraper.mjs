#!/usr/bin/env node
/**
 * wzstats.gg PRO scraper
 * =======================
 *
 * Descarga TODO lo público de wzstats.gg para varios juegos y modos.
 * Salida estructurada por juego/modo/idioma.
 *
 * Fuentes consumidas:
 *   1. weapons-and-tier-lists  → lista canónica + tier list oficial
 *   2. builds/wzstats/...      → builds curados con attachments
 *   3. loadouts/full           → loadouts completos (perks + specialist + equip)
 *   4. all-attachments         → todos los attachments por arma con unlockLevel
 *   5. pros-cons               → pros / contras
 *   6. best-perks              → perks recomendados
 *   7. equipments              → equipos (lethal/tactical/field)
 *   8. best-alternatives       → armas similares mejor rankeadas
 *   9. best-to-pair-with       → secundarias recomendadas
 *   10. articles (rankings)    → categorías "Largo Alcance" / "Corto Alcance" / etc
 *   11. orden visual (HTML)    → orden de aparición en la home (opcional con --browser)
 *
 * CLI:
 *   node scraper.mjs                                  # todo, en español
 *   node scraper.mjs --game bo7                       # solo bo7
 *   node scraper.mjs --game bo7 --mode multiplayer
 *   node scraper.mjs --lang es,en                     # multi idioma
 *   node scraper.mjs --skip-details                   # sin pros/cons/perks/attachments por arma (rápido)
 *   node scraper.mjs --skip-builds
 *   node scraper.mjs --browser                        # incluir orden visual (requiere playwright)
 *   node scraper.mjs --quiet
 *   node scraper.mjs --list                           # listar targets
 *
 * Output:
 *   dumps/{game}/{mode}-{lang}.json     ← data por target
 *   dumps/_meta/seasons.json            ← versiones por juego
 *   dumps/_meta/last-run.json           ← resumen
 *   logs/scraper-YYYY-MM-DD.log         ← log con rotación
 *   logs/diff-YYYY-MM-DD-HHMM.json      ← diff completo de este run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Output va a apps/web/public/wz/dumps (lo sirve Next.js). Override con WZSCRAPER_OUT.
const DUMPS = process.env.WZSCRAPER_OUT || path.join(__dirname, '../../apps/web/public/wz/dumps');
const LOGS = process.env.WZSCRAPER_LOGS || path.join(__dirname, 'logs');
fs.mkdirSync(DUMPS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });
fs.mkdirSync(path.join(DUMPS, '_meta'), { recursive: true });

// ─── Config ───────────────────────────────────────────────────────────────
const BASE = 'https://app.wzstats.gg';
const CONCURRENCY = 12;
const RETRIES = 2;
const RETRY_DELAY_MS = 500;
const TIMEOUT_MS = 30_000;

// Categorías de articles a buscar por juego.
// Cada juego puede tener distintas. El scraper hace fetch y si devuelve [] no se incluye.
const CATEGORY_TAGS = [
  { tag: 'long-range',     label: { es: 'Largo Alcance',          en: 'Long Range' } },
  { tag: 'short-range',    label: { es: 'Corto Alcance',          en: 'Short Range' } },
  { tag: 'sniper-support', label: { es: 'Soporte de francotirador', en: 'Sniper Support' } },
  { tag: 'assault-rifle',  label: { es: 'Fusil de asalto',        en: 'Assault Rifle' } },
  { tag: 'smg',            label: { es: 'Subfusil',                en: 'SMG' } },
  { tag: 'sniper-rifle',   label: { es: 'Francotirador',           en: 'Sniper Rifle' } },
  { tag: 'lmg',            label: { es: 'Ametralladora',           en: 'LMG' } },
  { tag: 'shotgun',        label: { es: 'Escopeta',                en: 'Shotgun' } },
  { tag: 'pistol',         label: { es: 'Pistola',                 en: 'Pistol' } },
  { tag: 'marksman-rifle', label: { es: 'Fusil tirador',           en: 'Marksman Rifle' } },
  { tag: 'battle-rifle',   label: { es: 'Fusil de batalla',        en: 'Battle Rifle' } },
];

// Targets: juego × modo × atributos para weapons-list endpoint
const TARGETS = [
  {
    game: 'bo7', mode: 'multiplayer',
    weaponGames: ['bo7'],
    tierlists: ['bo7'],
    attrs: ['game','name','type','isNew','unlockedAtPlayerLevel','updateBO7','displayType','imageVersion','weaponCode','bo7RankedBanned','warzoneRankedBanned','ironGauntletBanned','bo7RankedAttachmentsDisabled','modifierUpdatedAt'],
    buildsGame: 'bo7',
    articleTags: ['bo7', 'multiplayer'],
    map: 'bo7',
  },
  {
    game: 'bo7', mode: 'ranked',
    weaponGames: ['bo7'],
    tierlists: ['bo7Ranked'],
    attrs: ['game','name','type','isNew','unlockedAtPlayerLevel','updateBO7','displayType','imageVersion','weaponCode','bo7RankedBanned'],
    buildsGame: 'bo7',
    articleTags: ['bo7', 'ranked'],
    map: 'bo7',
  },
  {
    game: 'bo6', mode: 'multiplayer',
    weaponGames: ['bo6'],
    tierlists: ['bo6'],
    attrs: ['game','name','type','isNew','updateBO6','displayType','imageVersion'],
    buildsGame: 'bo6',
    articleTags: ['bo6', 'multiplayer'],
    map: 'bo6',
  },
  {
    game: 'bo6', mode: 'ranked',
    weaponGames: ['bo6'],
    tierlists: ['bo6Ranked'],
    attrs: ['game','name','type','isNew','updateBO6','displayType','imageVersion'],
    buildsGame: 'bo6',
    articleTags: ['bo6', 'ranked'],
    map: 'bo6',
  },
  {
    game: 'warzone', mode: 'warzone',
    weaponGames: ['mw3','mw2','bo6','bo7'],
    tierlists: ['alMazrah'],
    attrs: ['game','name','type','isNew','updateMW2','updateWZ2','updateBO6','updateBO7','displayType','sniperSupportRank','imageVersion','weaponCode','warzoneRankedBanned','ironGauntletBanned','modifierUpdatedAt'],
    buildsGame: 'wz2',
    articleTags: ['warzone'],
    map: 'alMazrah',
  },
];

// ─── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, def = null) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  return argv[i + 1] ?? true;
}
const VERBOSE = !argv.includes('--quiet');
const filterGame = arg('game');
const filterMode = arg('mode');
const langs = (arg('lang', 'es') + '').split(',');
const skipDetails = argv.includes('--skip-details');
const skipBuilds = argv.includes('--skip-builds');
const skipArticles = argv.includes('--skip-articles');
const skipAttachments = argv.includes('--skip-attachments');
const useBrowser = argv.includes('--browser');
const dryRun = argv.includes('--dry-run');

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(2, 35).join('\n').replace(/^ \*/gm, ''));
  process.exit(0);
}

if (argv.includes('--list')) {
  console.log('Targets configurados:');
  for (const t of TARGETS) console.log(`  ${t.game.padEnd(8)} ${t.mode}`);
  console.log(`Idiomas soportados: es, en`);
  process.exit(0);
}

const targets = TARGETS.filter(
  (t) => (!filterGame || filterGame === 'all' || t.game === filterGame) && (!filterMode || t.mode === filterMode),
);
if (targets.length === 0) {
  console.error('No targets. Disponibles:', TARGETS.map(t => `${t.game}/${t.mode}`).join(', '));
  process.exit(1);
}

// ─── Utils ────────────────────────────────────────────────────────────────
const log = VERBOSE ? (...a) => console.log(...a) : () => {};
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;
const err = (s) => `\x1b[31m${s}\x1b[0m`;

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function fetchJSON(url, { retries = RETRIES, allow404 = true } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!r.ok) {
        if (r.status === 404 && allow404) return null;
        throw new Error(`HTTP ${r.status}`);
      }
      return await r.json();
    } catch (e) {
      if (attempt === retries) {
        log(dim(`    ↯ fetch fail ${url.replace(BASE, '')}: ${e.message}`));
        return null;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

async function pool(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let i = 0, done = 0;
  async function spin() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
      done++;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, spin));
  return results;
}

// Etiquetas humanas para playstyles devueltos por la API (UPPER_SNAKE_CASE).
const PLAYSTYLE_LABELS = {
  LONG_RANGE: { es: 'Largo Alcance', en: 'Long Range' },
  SHORT_RANGE: { es: 'Corto Alcance', en: 'Short Range' },
  LOW_RECOIL: { es: 'Bajo Retroceso', en: 'Low Recoil' },
  HIGH_BULLET_VELOCITY: { es: 'Alta Velocidad de Bala', en: 'High Bullet Velocity' },
  HIP_FIRE: { es: 'Disparo de Cadera', en: 'Hip Fire' },
  TAC_STANCE: { es: 'Postura Táctica', en: 'Tac Stance' },
  CONVERSION_KIT: { es: 'Kit de Conversión', en: 'Conversion Kit' },
  MOBILITY: { es: 'Movilidad', en: 'Mobility' },
  ADS_SPEED: { es: 'Velocidad ADS', en: 'ADS Speed' },
  SNIPER_SUPPORT: { es: 'Soporte Francotirador', en: 'Sniper Support' },
  AKIMBO: { es: 'Akimbo', en: 'Akimbo' },
  SUPPRESSED: { es: 'Silenciado', en: 'Suppressed' },
  QUICK_SCOPE: { es: 'Quick Scope', en: 'Quick Scope' },
  BATTLE_ROYALE: { es: 'Battle Royale', en: 'Battle Royale' },
  RESURGENCE: { es: 'Resurgence', en: 'Resurgence' },
  RANKED: { es: 'Ranked', en: 'Ranked' },
  VERSATILE: { es: 'Versátil', en: 'Versatile' },
  FULL_AUTO: { es: 'Full Auto', en: 'Full Auto' },
  SEMI_AUTO: { es: 'Semi Auto', en: 'Semi Auto' },
  RAPID_FIRE: { es: 'Cadencia Alta', en: 'Rapid Fire' },
  BURST: { es: 'Ráfaga', en: 'Burst' },
  EIGHT_ATTACHMENTS: { es: '8 Accesorios', en: '8 Attachments' },
  FIVE_ATTACHMENTS: { es: '5 Accesorios', en: '5 Attachments' },
  IRON_SIGHTS: { es: 'Mira de Hierro', en: 'Iron Sights' },
  WITH_OPTIC: { es: 'Con Óptica', en: 'With Optic' },
  LOW_LEVEL: { es: 'Bajo Nivel', en: 'Low Level' },
  AGGRESSIVE: { es: 'Agresivo', en: 'Aggressive' },
  BUILD: { es: 'Build', en: 'Build' },
  FIRERATE: { es: 'Cadencia', en: 'Fire Rate' },
};

function groupBuildsByPlaystyle(builds) {
  const groups = {};
  for (const b of builds || []) {
    const ps = b.playstyle || 'OTHER';
    if (!groups[ps]) groups[ps] = { playstyle: ps, label: PLAYSTYLE_LABELS[ps] || null, builds: [] };
    groups[ps].builds.push(b);
  }
  for (const g of Object.values(groups)) {
    g.builds.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999) || (b.tierScore ?? 0) - (a.tierScore ?? 0));
  }
  return Object.values(groups).sort((a, b) => b.builds.length - a.builds.length);
}

function buildQueryString(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => q.append(`${k}[]`, x));
    else q.set(k, v);
  }
  return q.toString();
}

// ─── Endpoints ────────────────────────────────────────────────────────────
function weaponsListUrl(t, lang) {
  const params = {
    streamerProfileId: 'wzstats',
    addConversionKit: 'true',
    language: lang,
  };
  t.weaponGames.forEach(g => (params.weaponGames ??= []).push(g));
  if (t.tierlists.length) t.tierlists.forEach(tl => (params.onlyTierlists ??= []).push(tl));
  t.attrs.forEach(a => (params.weaponAttributes ??= []).push(a));
  return `${BASE}/wz2/weapons/meta/weapons-and-tier-lists/?${buildQueryString(params)}`;
}

function buildsUrl(t, lang) {
  return `${BASE}/wz2/weapons/builds/wzstats/with-attachments/?${buildQueryString({
    game: t.buildsGame,
    language: lang,
    addConversionKit: 'true',
    addNewBuilds: 'true',
  })}`;
}

function loadoutsFullUrl(t, lang) {
  return `${BASE}/wz2/weapons/loadouts/full?${buildQueryString({
    addConversionKit: 'true',
    games: [t.buildsGame === 'warzone' ? 'warzone' : t.buildsGame],
    language: lang,
    map: t.map,
  })}`;
}

function attachmentsUrl(weaponId, lang) {
  return `${BASE}/warzone/weapons/attachments/all-attachments-for-weapon/?${buildQueryString({
    weaponId, authorId: 'wzstats-wz2', addConversionKitAttachments: 'true', language: lang,
  })}`;
}

function detailsUrls(game, mode, weaponId, lang) {
  const base = `${BASE}/v3/weapon/more-information`;
  const q = `?game=${game}&gamemode=${mode}&weaponId=${weaponId}&language=${lang}`;
  return {
    alts: `${base}/best-alternatives/${q}`,
    pair: `${base}/best-to-pair-with/${q}`,
    prosCons: `${base}/pros-cons/${q}`,
    perks: `${base}/best-perks/${q}`,
    equip: `${base}/equipments/${q}`,
  };
}

function articleUrl(t, tag, lang) {
  return `${BASE}/wz2/articles/?${buildQueryString({
    tags: [...t.articleTags, tag],
    language: lang,
  })}`;
}

function seasonUrl(game) {
  return `${BASE}/season/${game === 'warzone' ? 'warzone' : game}`;
}

// ─── Pipeline por target ──────────────────────────────────────────────────
async function scrapeTarget(t, lang) {
  const tag = bold(`[${t.game}/${t.mode}/${lang}]`);
  const t0 = Date.now();
  const stages = {};

  log(`\n${tag} ▸ arrancando`);

  // 1. Lista canónica + tier list
  const t1 = Date.now();
  const wl = await fetchJSON(weaponsListUrl(t, lang));
  stages.weapons = Date.now() - t1;
  if (!wl?.weapons) {
    log(`${tag} ${err('✗ sin weapons')}`);
    return null;
  }
  const tierKey = t.tierlists[0] || t.game;
  const tierList = wl.wzStatsTierList?.[tierKey] ?? {};
  const tierMap = new Map();
  for (const [tier, ids] of Object.entries(tierList)) for (const id of ids) tierMap.set(id, tier);
  for (const w of wl.weapons) w.tier = tierMap.get(w.id) ?? null;
  log(`${tag} ${ok('✓')} ${wl.weapons.length} armas · tier-list[${tierKey}] ${Object.keys(tierList).join('|') || '∅'} ${dim(`(${fmtMs(stages.weapons)})`)}`);

  // 2. Builds curados (paralelo a lo siguiente)
  let buildsByWeapon = new Map();
  let buildsTotal = 0;
  if (!skipBuilds) {
    const t2 = Date.now();
    const br = await fetchJSON(buildsUrl(t, lang));
    stages.builds = Date.now() - t2;
    const builds = br?.builds ?? [];
    buildsTotal = builds.length;
    for (const b of builds) {
      if (!buildsByWeapon.has(b.weaponId)) buildsByWeapon.set(b.weaponId, []);
      buildsByWeapon.get(b.weaponId).push(b);
    }
    log(`${tag} ${ok('✓')} ${buildsTotal} builds curados ${dim(`(${fmtMs(stages.builds)})`)}`);
  }

  // 3. Loadouts full (perks + specialist + equip)
  let loadoutsRaw = null;
  if (!skipBuilds) {
    const t3 = Date.now();
    loadoutsRaw = await fetchJSON(loadoutsFullUrl(t, lang));
    stages.loadouts = Date.now() - t3;
    const count = loadoutsRaw?.loadouts?.length || 0;
    log(`${tag} ${ok('✓')} ${count} loadouts full ${dim(`(${fmtMs(stages.loadouts)})`)}`);
  }

  // 4. Articles → categorías con rankings
  const badgesByWeapon = new Map();
  const categoryArticles = {};
  if (!skipArticles) {
    const t4 = Date.now();
    for (const cat of CATEGORY_TAGS) {
      const arts = await fetchJSON(articleUrl(t, cat.tag, lang));
      if (!arts?.length) continue;
      // Más reciente, no-Beta primero
      const sorted = arts.sort((a, b) => {
        const ab = (a.season || '').toLowerCase().includes('beta') ? 1 : 0;
        const bb = (b.season || '').toLowerCase().includes('beta') ? 1 : 0;
        if (ab !== bb) return ab - bb;
        return (b.publishedAt || '').localeCompare(a.publishedAt || '');
      });
      const article = sorted[0];
      if (!article?.weapons?.length) continue;
      categoryArticles[cat.tag] = {
        label: cat.label[lang] || cat.label.es,
        season: article.season,
        publishedAt: article.publishedAt,
        url: article.url,
        weapons: article.weapons,
      };
      article.weapons.forEach((wid, idx) => {
        if (!badgesByWeapon.has(wid)) badgesByWeapon.set(wid, []);
        badgesByWeapon.get(wid).push({
          rank: idx + 1,
          category: cat.label[lang] || cat.label.es,
          tag: cat.tag,
        });
      });
    }
    stages.articles = Date.now() - t4;
    log(`${tag} ${ok('✓')} ${Object.keys(categoryArticles).length} categorías · ${badgesByWeapon.size} armas con badge ${dim(`(${fmtMs(stages.articles)})`)}`);
  }

  // 5. Details + attachments por arma (paralelo, concurrencia=N)
  if (!skipDetails || !skipAttachments) {
    const t5 = Date.now();
    let progressShown = 0;
    await pool(wl.weapons, CONCURRENCY, async (w) => {
      const urls = detailsUrls(t.game, t.mode, w.id, lang);
      const tasks = [];
      if (!skipDetails) {
        tasks.push(
          fetchJSON(urls.alts).then(v => ['alts', v]),
          fetchJSON(urls.pair).then(v => ['pair', v]),
          fetchJSON(urls.prosCons).then(v => ['prosCons', v]),
          fetchJSON(urls.perks).then(v => ['perks', v]),
          fetchJSON(urls.equip).then(v => ['equip', v]),
        );
      }
      if (!skipAttachments) {
        tasks.push(fetchJSON(attachmentsUrl(w.id, lang)).then(v => ['attachments', v]));
      }
      const settled = await Promise.all(tasks);
      w.details = Object.fromEntries(settled);
      w.builds = buildsByWeapon.get(w.id) || [];
      w.buildsByPlaystyle = groupBuildsByPlaystyle(w.builds);
      w.badges = (badgesByWeapon.get(w.id) || []).sort((a, b) => a.rank - b.rank);
    }, (done, total) => {
      const pct = Math.floor((done / total) * 10) * 10;
      if (pct > progressShown) {
        process.stdout.write(`${tag} ${dim(`  ${done}/${total} (${pct}%)\r`)}`);
        progressShown = pct;
      }
    });
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    stages.details = Date.now() - t5;
    log(`${tag} ${ok('✓')} details + attachments × ${wl.weapons.length} ${dim(`(${fmtMs(stages.details)}, concurrency=${CONCURRENCY})`)}`);
  } else {
    for (const w of wl.weapons) {
      w.details = {};
      w.builds = buildsByWeapon.get(w.id) || [];
      w.buildsByPlaystyle = groupBuildsByPlaystyle(w.builds);
      w.badges = (badgesByWeapon.get(w.id) || []).sort((a, b) => a.rank - b.rank);
    }
  }

  // 6. Imágenes URL (no fetch — solo construir paths)
  for (const w of wl.weapons) {
    const v = w.imageVersion || '4';
    w.images = {
      thumb: `https://img.wzstats.gg/${w.id}_version${v}/gunDisplayLoadouts`,
      full: `https://img.wzstats.gg/${w.id}/public`,
    };
  }

  const dump = {
    meta: {
      scraper: 'wzstats-pro',
      version: '2.0',
      game: t.game,
      gamemode: t.mode,
      language: lang,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      stages,
    },
    counts: {
      weapons: wl.weapons.length,
      builds: buildsTotal,
      categories: Object.keys(categoryArticles).length,
      withBadges: badgesByWeapon.size,
    },
    tierList,
    categoryArticles,
    loadoutsFull: loadoutsRaw,
    weapons: wl.weapons,
  };

  const outDir = path.join(DUMPS, t.game);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${t.mode}-${lang}.json`);

  const prev = readPrev(outPath);
  const diff = computeDiff(prev, dump);

  if (!dryRun) fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));
  const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : Buffer.byteLength(JSON.stringify(dump));

  const elapsed = Date.now() - t0;
  log(`${tag} ${ok('✓ DUMP')} ${path.relative(__dirname, outPath)} ${dim(`(${fmtBytes(size)}, ${fmtMs(elapsed)})`)}`);
  if (diff.isFirst) log(`${tag} ${dim('  diff: primer scrape')}`);
  else {
    const parts = [];
    if (diff.added.length) parts.push(ok(`+${diff.added.length}`));
    if (diff.removed.length) parts.push(err(`−${diff.removed.length}`));
    if (diff.changed.length) parts.push(warn(`Δ${diff.changed.length}`));
    log(`${tag} ${dim('  diff:')} ${parts.join(' ') || dim('sin cambios')}`);
    if (diff.added.length) log(`${tag} ${ok('  + agregadas:')} ${diff.added.slice(0, 6).join(', ')}${diff.added.length > 6 ? '...' : ''}`);
    if (diff.removed.length) log(`${tag} ${err('  − borradas:')} ${diff.removed.join(', ')}`);
  }

  return { target: t, lang, dump, diff, sizeBytes: size, durationMs: elapsed, outPath };
}

function readPrev(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function computeDiff(prev, curr) {
  if (!prev?.weapons) return { isFirst: true, added: curr.weapons.map(w => w.id), removed: [], changed: [] };
  const prevMap = new Map(prev.weapons.map(w => [w.id, w]));
  const currMap = new Map(curr.weapons.map(w => [w.id, w]));
  const added = [...currMap.keys()].filter(k => !prevMap.has(k));
  const removed = [...prevMap.keys()].filter(k => !currMap.has(k));
  const changed = [];
  for (const [id, w] of currMap) {
    const p = prevMap.get(id);
    if (!p) continue;
    const sig = JSON.stringify({ tier: w.tier, isNew: w.isNew, name: w.name, builds: w.builds?.length ?? 0, badges: w.badges?.length ?? 0 });
    const psig = JSON.stringify({ tier: p.tier, isNew: p.isNew, name: p.name, builds: p.builds?.length ?? 0, badges: p.badges?.length ?? 0 });
    if (sig !== psig) changed.push(id);
  }
  return { isFirst: false, added, removed, changed };
}

// ─── DOM scrape: orden + badges + pickRate + type (requiere Playwright) ───
// Esto es la FUENTE DE VERDAD para badges y orden visual, ya que la API
// no expone esa info actualizada (los articles están en season Beta).
async function scrapeDomData(t, lang) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { log(warn('Playwright no instalado — skip DOM scrape.')); return null; }

  const URLs = t.game === 'warzone'
    ? [`https://wzstats.gg/${lang}/warzone/meta`, `https://wzstats.gg/warzone/meta`]
    : t.game === 'bo7'
    ? [`https://wzstats.gg/${lang}/bo7/meta`, `https://wzstats.gg/bo7/meta`, `https://wzstats.gg/${lang}/bo7`, `https://wzstats.gg/bo7`]
    : t.game === 'bo6'
    ? [`https://wzstats.gg/${lang}/bo6/meta`, `https://wzstats.gg/bo6/meta`, `https://wzstats.gg/${lang}/bo6`, `https://wzstats.gg/bo6`]
    : [`https://wzstats.gg/${lang}/${t.game}`, `https://wzstats.gg/${t.game}`];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 } }).then(c => c.newPage());
  let data = [];
  for (const url of URLs) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000);
      for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(200); }
      await page.waitForTimeout(2000);
      data = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.loadout-container')];
        const seen = new Set();
        const out = [];
        cards.forEach((card, i) => {
          const id = card.querySelector('img')?.getAttribute('alt');
          if (!id || seen.has(id)) return;
          seen.add(id);
          const name = card.querySelector('.loadout-content-name, h3')?.textContent?.trim() || '';
          const badges = [...card.querySelectorAll('.loadout-tag.category-position')].map(el => {
            const rank = parseInt(el.querySelector('.rank')?.textContent?.replace('#','') || '0');
            const category = (el.textContent?.trim() || '').replace(/^#\d+\s*/, '').trim();
            return { rank, category, isFirst: el.classList.contains('first-place') };
          });
          const typeTag = [...card.querySelectorAll('.loadout-tag')].find(el =>
            !el.classList.contains('category-position') && !el.classList.contains('hide'));
          const type = typeTag?.textContent?.trim() || null;
          const pickRateEl = [...card.querySelectorAll('.loadout-tag.hide')].find(el =>
            /Tasa de elecci|Pick Rate/i.test(el.textContent || ''));
          const pickRate = pickRateEl?.textContent?.match(/[\d.]+%/)?.[0] || null;
          const classesEl = [...card.querySelectorAll('.loadout-tag.hide')].find(el =>
            /Clases|Classes/i.test(el.textContent || ''));
          const classes = classesEl?.textContent?.match(/(\d+)/)?.[1];
          out.push({
            position: out.length + 1, id, name, type,
            badges, pickRate,
            classes: classes ? parseInt(classes) : null,
          });
        });
        return out;
      });
      if (data.length >= 10) break;
    } catch {}
  }
  await browser.close();
  return data.length ? data : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
console.log(bold(`\n╔═══ wzstats PRO scraper · ${new Date().toLocaleString('es-CL')}`));
console.log(`║ Targets: ${targets.map(t => `${t.game}/${t.mode}`).join(', ')}`);
console.log(`║ Idiomas: ${langs.join(', ')}`);
console.log(`║ Flags: ${[
  skipDetails && 'skip-details', skipBuilds && 'skip-builds', skipArticles && 'skip-articles',
  skipAttachments && 'skip-attachments', useBrowser && 'browser', dryRun && 'dry-run',
].filter(Boolean).join(', ') || 'none'}`);
console.log(`╚════════════════════════════════════════════════════\n`);

// Seasons (en paralelo, una sola vez)
const seasons = {};
await Promise.all(['bo7','bo6','warzone'].map(async (g) => {
  const s = await fetchJSON(seasonUrl(g));
  if (s) seasons[g] = s;
}));
fs.writeFileSync(path.join(DUMPS, '_meta/seasons.json'), JSON.stringify(seasons, null, 2));
log(`Seasons: ${Object.entries(seasons).map(([g, s]) => `${g}=v${s.version}`).join(' · ')}\n`);

// Scrape por target × lang
const results = [];
for (const t of targets) {
  for (const lang of langs) {
    try {
      const r = await scrapeTarget(t, lang);
      if (r) results.push(r);
    } catch (e) {
      console.error(err(`[${t.game}/${t.mode}/${lang}] ERROR:`), e.message);
    }
  }
}

// DOM scrape (si --browser): aplica badges + pickRate + orden REAL a cada dump
if (useBrowser) {
  console.log(`\n${bold('DOM scrape (orden + badges + pickRate)')}`);
  for (const t of targets) {
    for (const lang of langs) {
      const dom = await scrapeDomData(t, lang);
      if (!dom) continue;
      log(`${bold(`[${t.game}/${t.mode}/${lang}]`)} ${ok('✓')} ${dom.length} armas del DOM`);

      // Mergear al dump existente
      const dumpPath = path.join(DUMPS, t.game, `${t.mode}-${lang}.json`);
      if (!fs.existsSync(dumpPath)) continue;
      const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
      const domMap = new Map(dom.map(d => [d.id, d]));
      for (const w of dump.weapons) {
        const d = domMap.get(w.id);
        if (d) {
          w.position = d.position;
          w.badges = d.badges;
          w.pickRate = d.pickRate;
          w.classes = d.classes;
          w.displayTypeLabel = d.type;
        }
      }
      // Re-ordenar weapons según posición DOM (sin posición van al final)
      dump.weapons.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
      fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
      log(`${bold(`[${t.game}/${t.mode}/${lang}]`)} ${ok('✓ merged DOM data')} en ${dom.filter(d => domMap.has(d.id)).length} armas del dump`);
    }
  }
}

// Resumen final + diff log
const summary = {
  runId: RUN_ID,
  ranAt: new Date().toISOString(),
  totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
  totalBytes: results.reduce((s, r) => s + r.sizeBytes, 0),
  totalWeapons: results.reduce((s, r) => s + r.dump.counts.weapons, 0),
  targets: results.map(r => ({
    game: r.target.game, mode: r.target.mode, lang: r.lang,
    counts: r.dump.counts,
    diff: { added: r.diff.added.length, removed: r.diff.removed.length, changed: r.diff.changed.length },
    durationMs: r.durationMs,
    sizeBytes: r.sizeBytes,
    outPath: path.relative(__dirname, r.outPath),
  })),
};
fs.writeFileSync(path.join(DUMPS, '_meta/last-run.json'), JSON.stringify(summary, null, 2));
fs.appendFileSync(path.join(LOGS, 'history.jsonl'), JSON.stringify(summary) + '\n');

console.log(`\n${bold('═══ RESUMEN')}`);
console.log(`Targets: ${results.length} · armas total: ${summary.totalWeapons} · size: ${fmtBytes(summary.totalBytes)} · ${fmtMs(summary.totalDurationMs)}`);
for (const r of results) {
  const c = r.dump.counts;
  console.log(`  ${bold(`${r.target.game}/${r.target.mode}/${r.lang}`)}: ${c.weapons}w · ${c.builds}b · ${c.categories}cats · ${c.withBadges}badged · ${fmtBytes(r.sizeBytes)}`);
}
console.log(`\n${dim('Output:')} ${path.relative(__dirname, DUMPS)}/`);
console.log(`${dim('Logs:')} ${path.relative(__dirname, LOGS)}/`);
