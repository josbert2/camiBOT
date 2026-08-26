/**
 * Detección de "en vivo" para Twitch, Kick y TikTok.
 * - Twitch: API oficial Helix (requiere TWITCH_CLIENT_ID/SECRET; si faltan, se saltea).
 * - Kick: endpoint público channels/{slug} (puede fallar por Cloudflare).
 * - TikTok: sin API oficial → scrape best-effort de la página /live (frágil).
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export type StreamPlatform = 'twitch' | 'kick' | 'tiktok';

export type LiveInfo = {
  platform: StreamPlatform;
  title: string | null;
  url: string;
  thumb: string | null;
  viewers: number | null;
  startedAt: Date | null;
};

// --- Twitch ---

let twitchToken: { token: string; exp: number } | null = null;

async function twitchAppToken(): Promise<string | null> {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  const now = Date.now();
  if (twitchToken && twitchToken.exp > now + 60_000) return twitchToken.token;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
      { method: 'POST' },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token: string; expires_in: number };
    twitchToken = { token: j.access_token, exp: now + j.expires_in * 1000 };
    return twitchToken.token;
  } catch {
    return null;
  }
}

/** Devuelve un map login(lowercase) → LiveInfo para los que estén en vivo. */
export async function twitchLive(logins: string[]): Promise<Map<string, LiveInfo>> {
  const out = new Map<string, LiveInfo>();
  if (!logins.length) return out;
  const id = process.env.TWITCH_CLIENT_ID;
  const token = await twitchAppToken();
  if (!id || !token) return out;

  for (let i = 0; i < logins.length; i += 100) {
    const batch = logins.slice(i, i + 100);
    const qs = batch.map((l) => `user_login=${encodeURIComponent(l)}`).join('&');
    try {
      const res = await fetch(`https://api.twitch.tv/helix/streams?${qs}`, {
        headers: { 'Client-Id': id, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        data?: Array<{
          user_login: string;
          title?: string;
          viewer_count?: number;
          started_at?: string;
          thumbnail_url?: string;
        }>;
      };
      for (const s of j.data ?? []) {
        out.set(String(s.user_login).toLowerCase(), {
          platform: 'twitch',
          title: s.title ?? null,
          url: `https://twitch.tv/${s.user_login}`,
          thumb: s.thumbnail_url ? s.thumbnail_url.replace('{width}', '640').replace('{height}', '360') : null,
          viewers: s.viewer_count ?? null,
          startedAt: s.started_at ? new Date(s.started_at) : null,
        });
      }
    } catch {
      // batch falló, seguimos
    }
  }
  return out;
}

// --- Kick ---

export async function kickLive(slug: string): Promise<LiveInfo | null> {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      livestream?: {
        is_live?: boolean;
        session_title?: string;
        viewer_count?: number;
        created_at?: string;
        thumbnail?: { url?: string } | null;
      } | null;
    };
    const ls = j.livestream;
    if (!ls || ls.is_live === false) return null;
    return {
      platform: 'kick',
      title: ls.session_title ?? null,
      url: `https://kick.com/${slug}`,
      thumb: ls.thumbnail?.url ?? null,
      viewers: ls.viewer_count ?? null,
      startedAt: ls.created_at ? new Date(ls.created_at) : null,
    };
  } catch {
    return null;
  }
}

// --- TikTok (best-effort) ---

export async function tiktokLive(user: string): Promise<LiveInfo | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(user)}/live`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Heurística: la página de un live activo trae un roomId y estado de live.
    const hasRoom = /"roomId":"?\d{6,}"?/.test(html);
    const liveOn = /"liveRoomStatus":2|"status":2|"isLiveBroadcast"\s*:\s*true|"role":\s*0[^}]*"status":\s*2/.test(html);
    const offline = /"liveRoomStatus":4|"live_room_status":4|user is offline/i.test(html);
    if (!hasRoom || offline || !liveOn) return null;
    return {
      platform: 'tiktok',
      title: null,
      url: `https://www.tiktok.com/@${user}/live`,
      thumb: null,
      viewers: null,
      startedAt: null,
    };
  } catch {
    return null;
  }
}
