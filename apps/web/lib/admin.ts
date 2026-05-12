import type { Session } from 'next-auth';

/**
 * Lee la lista de Discord IDs habilitados como admin desde
 * `ADMIN_DISCORD_IDS` (CSV: "123,456,789").
 *
 * Es un mecanismo simple sin tabla — para cambiar quién es admin
 * editás el .env.production y reiniciás camibot-web.
 */
function getAdminIds(): string[] {
  const raw = process.env.ADMIN_DISCORD_IDS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdmin(session: Session | null | undefined): boolean {
  if (!session?.user?.discordId) return false;
  return getAdminIds().includes(session.user.discordId);
}
