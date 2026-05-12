import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const HEARTBEAT_KEY = 'camibot:bot:heartbeat';
const HEARTBEAT_TTL_SECONDS = 90;
const HEARTBEAT_INTERVAL_MS = 30_000;

let redis: Redis | null = null;
let timer: NodeJS.Timeout | null = null;

async function tick() {
  if (!redis) return;
  try {
    await redis.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', HEARTBEAT_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'Heartbeat Redis fallido (no es crítico)');
  }
}

export function startHeartbeat() {
  if (timer) return;
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
  redis.on('error', (err) => logger.warn({ err: err.message }, 'Redis heartbeat conexión error'));
  void tick();
  timer = setInterval(tick, HEARTBEAT_INTERVAL_MS);
}

export async function stopHeartbeat() {
  if (timer) clearInterval(timer);
  timer = null;
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
}
