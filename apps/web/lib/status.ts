import { Redis } from 'ioredis';
import { prisma } from '@camibot/db';

const HEARTBEAT_KEY = 'camibot:bot:heartbeat';
const HEARTBEAT_FRESH_MS = 90_000;

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    redis.on('error', () => {});
  }
  return redis;
}

export type StatusValue = 'ONLINE' | 'OFFLINE' | 'CONNECTED' | 'DOWN' | 'PROD' | 'DEV';

export async function getBotStatus(): Promise<StatusValue> {
  try {
    const ts = await getRedis().get(HEARTBEAT_KEY);
    if (!ts) return 'OFFLINE';
    const age = Date.now() - parseInt(ts, 10);
    return age < HEARTBEAT_FRESH_MS ? 'ONLINE' : 'OFFLINE';
  } catch {
    return 'OFFLINE';
  }
}

export async function getDbStatus(): Promise<StatusValue> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'CONNECTED';
  } catch {
    return 'DOWN';
  }
}

export function getWebStatus(): StatusValue {
  return process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
}

export async function getPhase(): Promise<string> {
  // Single source of truth para la fase actual.
  // Fase 1.5: VCs por match + random seeding + bracket SVG público.
  return '1.5/5';
}

export async function getCounts() {
  try {
    const [tournaments, guilds] = await Promise.all([
      prisma.tournament.count(),
      prisma.guild.count(),
    ]);
    return { tournaments, guilds };
  } catch {
    return { tournaments: 0, guilds: 0 };
  }
}
