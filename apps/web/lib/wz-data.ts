import fs from 'node:fs';
import path from 'node:path';

const DUMPS_DIR = path.join(process.cwd(), 'public', 'wz', 'dumps');

export type WzBadge = { rank: number; category: string; tag?: string };
export type WzBuildAttachment = {
  attachmentId?: string;
  slot?: string;
  name?: string;
  verticalTuning?: number;
  horizontalTuning?: number;
};
export type WzBuild = {
  id: string;
  weaponId: string;
  title?: string;
  playstyle?: string;
  position?: number;
  displayOrder?: number;
  tierScore?: number;
  isBestBuild?: boolean;
  isBO7BestBuild?: boolean;
  isBO6BestBuild?: boolean;
  bestBuildForStats?: boolean;
  isBestPlaystyleVariant?: boolean;
  pros?: string[];
  cons?: string[];
  description?: string;
  prosCons?: string;
} & Record<string, WzBuildAttachment | string | number | boolean | string[] | undefined>;

export type WzWeapon = {
  id: string;
  name: string;
  type?: string;
  game?: string; // mw2 | mw3 | bo6 | bo7
  tier?: string | null;
  isNew?: boolean;
  imageVersion?: number | string;
  position?: number;
  pickRate?: string;
  classes?: number;
  displayTypeLabel?: string;
  badges?: WzBadge[];
  builds?: WzBuild[];
  buildsByPlaystyle?: { playstyle: string; label?: { es: string; en: string } | null; builds: WzBuild[] }[];
  unlockedAtPlayerLevel?: number;
  details?: {
    prosCons?: { pros?: { name: string }[]; cons?: { name: string }[] };
    perks?: unknown;
    equip?: unknown;
    alts?: unknown;
    pair?: unknown;
    attachments?: { attachmentId?: string; unlockLevel?: number; lockedByDefault?: boolean; unlockedByBattlePass?: boolean; isPrestigeAttachment?: boolean; isConversionKitAttachment?: boolean }[];
  };
};

export type WzDump = {
  meta: { generatedAt: string; durationMs: number; game: string; gamemode: string; language: string };
  counts: { weapons: number; builds: number; categories: number; withBadges: number };
  tierList: Record<string, string[]>;
  categoryArticles?: Record<string, { label: string; season?: string; weapons: string[] }>;
  weapons: WzWeapon[];
};

const DUMP_KEYS = {
  'warzone': 'warzone/warzone-es',
  'bo7-mp': 'bo7/multiplayer-es',
  'bo7-ranked': 'bo7/ranked-es',
  'bo6-mp': 'bo6/multiplayer-es',
  'bo6-ranked': 'bo6/ranked-es',
} as const;

export type WzDumpKey = keyof typeof DUMP_KEYS;

// Cache en memoria; cada dump puede pesar varios MB. Invalidate manual al re-build.
const cache = new Map<WzDumpKey, { dump: WzDump; mtime: number }>();

export function loadDump(key: WzDumpKey = 'warzone'): WzDump | null {
  const rel = DUMP_KEYS[key];
  if (!rel) return null;
  const filePath = path.join(DUMPS_DIR, `${rel}.json`);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  const cached = cache.get(key);
  if (cached && cached.mtime === stat.mtimeMs) return cached.dump;
  const dump = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WzDump;
  cache.set(key, { dump, mtime: stat.mtimeMs });
  return dump;
}

export function getWeapon(weaponId: string, key: WzDumpKey = 'warzone'): WzWeapon | null {
  const dump = loadDump(key);
  if (!dump) return null;
  return dump.weapons.find((w) => w.id === weaponId) ?? null;
}

export function listWeapons(key: WzDumpKey = 'warzone'): WzWeapon[] {
  const dump = loadDump(key);
  return dump?.weapons ?? [];
}

export function allDumpKeys(): WzDumpKey[] {
  return Object.keys(DUMP_KEYS) as WzDumpKey[];
}

export function isRecommendedBuild(b: WzBuild): boolean {
  if (b.isBestBuild || b.isBO7BestBuild || b.isBO6BestBuild || b.bestBuildForStats) return true;
  if (b.prosCons && /"is(BO[67])?BestBuild":true/.test(b.prosCons)) return true;
  return false;
}

export const PLAYSTYLE_LABEL: Record<string, string> = {
  LONG_RANGE: 'Largo Alcance',
  SHORT_RANGE: 'Corto Alcance',
  LOW_RECOIL: 'Bajo Retroceso',
  HIGH_BULLET_VELOCITY: 'Alta Velocidad de Bala',
  HIP_FIRE: 'Disparo de Cadera',
  TAC_STANCE: 'Postura Táctica',
  CONVERSION_KIT: 'Kit de Conversión',
  MOBILITY: 'Movilidad',
  ADS_SPEED: 'Velocidad ADS',
  SNIPER_SUPPORT: 'Soporte Francotirador',
  AKIMBO: 'Akimbo',
  SUPPRESSED: 'Silenciado',
  QUICK_SCOPE: 'Quick Scope',
  BATTLE_ROYALE: 'Battle Royale',
  RESURGENCE: 'Resurgence',
  RANKED: 'Ranked',
  VERSATILE: 'Versátil',
  PRESTIGE: 'Prestigio',
  FULL_AUTO: 'Full Auto',
  SEMI_AUTO: 'Semi Auto',
  RAPID_FIRE: 'Cadencia Alta',
  BURST: 'Ráfaga',
  EIGHT_ATTACHMENTS: '8 Accesorios',
  FIVE_ATTACHMENTS: '5 Accesorios',
  IRON_SIGHTS: 'Mira de Hierro',
  WITH_OPTIC: 'Con Óptica',
  LOW_LEVEL: 'Bajo Nivel',
  AGGRESSIVE: 'Agresivo',
  BUILD: 'Build',
  FIRERATE: 'Cadencia',
};

export const TYPE_LABEL: Record<string, string> = {
  ASSAULT_RIFLE: 'Fusil de Asalto',
  SUBMACHINE_GUN: 'Subfusil',
  SMG: 'Subfusil',
  SHOTGUN: 'Escopeta',
  SNIPER_RIFLE: 'Francotirador',
  SNIPER: 'Francotirador',
  MARKSMAN_RIFLE: 'Fusil Tirador',
  LMG: 'Ametralladora Ligera',
  LIGHT_MACHINE_GUN: 'Ametralladora Ligera',
  PISTOL: 'Pistola',
  HANDGUN: 'Pistola',
  BATTLE_RIFLE: 'Fusil de Batalla',
  MELEE: 'Cuerpo a Cuerpo',
  LAUNCHER: 'Lanzacohetes',
};

export const GAME_LABEL: Record<string, string> = {
  bo7: 'Black Ops 7',
  bo6: 'Black Ops 6',
  mw3: 'Modern Warfare III',
  mw2: 'Modern Warfare II',
};

export const SLOT_LABEL: Record<string, string> = {
  optic: 'Mira',
  barrel: 'Cañón',
  muzzle: 'Bocacha',
  underbarrel: 'Acople',
  magazine: 'Cargador',
  rearGrip: 'Empuñadura Trasera',
  stock: 'Culata',
  stockPad: 'Culata',
  laser: 'Láser',
  ammunition: 'Munición',
  firemods: 'Mods de Disparo',
  trigger: 'Disparador',
  bolt: 'Cerrojo',
};

const SLOT_ORDER = ['optic', 'muzzle', 'barrel', 'underbarrel', 'magazine', 'rearGrip', 'stock', 'stockPad', 'laser', 'ammunition', 'firemods', 'trigger', 'bolt'];

export function extractAttachments(build: WzBuild): WzBuildAttachment[] {
  const out: WzBuildAttachment[] = [];
  for (const slot of SLOT_ORDER) {
    const v = build[slot];
    if (v && typeof v === 'object' && 'attachmentId' in (v as object)) {
      out.push({ slot, ...(v as WzBuildAttachment) });
    }
  }
  return out;
}

export function weaponImage(w: WzWeapon, kind: 'thumb' | 'full' = 'thumb'): string {
  const v = w.imageVersion ?? '4';
  if (kind === 'full') return `https://img.wzstats.gg/${w.id}/public`;
  return `https://img.wzstats.gg/${w.id}_version${v}/gunDisplayLoadouts`;
}
