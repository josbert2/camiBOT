import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

const SALT = process.env.IP_HASH_SALT ?? 'camibot-dev-salt-change-me';

function pickClientIp(h: Headers): string {
  const cf = h.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const real = h.get('x-real-ip');
  if (real) return real.trim();

  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }

  return '0.0.0.0';
}

export async function getRequestIpHash(): Promise<string> {
  const h = await headers();
  const ip = pickClientIp(h);
  return createHash('sha256').update(`${SALT}:${ip}`).digest('hex');
}
