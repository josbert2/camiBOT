import type { Guild as DiscordGuild, User as DiscordUser } from 'discord.js';
import { prisma, type Guild, type User } from '@camibot/db';

/** Upsert del User a partir del User de Discord. */
export async function upsertUser(discordUser: DiscordUser): Promise<User> {
  return prisma.user.upsert({
    where: { discordId: discordUser.id },
    update: {
      username: discordUser.username,
      globalName: discordUser.globalName,
      avatar: discordUser.avatar,
    },
    create: {
      discordId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.globalName,
      avatar: discordUser.avatar,
    },
  });
}

/** Upsert del Guild a partir del Guild de Discord. */
export async function upsertGuild(discordGuild: DiscordGuild): Promise<Guild> {
  return prisma.guild.upsert({
    where: { discordId: discordGuild.id },
    update: {
      name: discordGuild.name,
      icon: discordGuild.icon,
      ownerId: discordGuild.ownerId,
    },
    create: {
      discordId: discordGuild.id,
      name: discordGuild.name,
      icon: discordGuild.icon,
      ownerId: discordGuild.ownerId,
    },
  });
}

/** Slug ASCII kebab-case. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Genera un slug único en el guild agregando -2, -3, ... si choca. */
export async function uniqueTournamentSlug(guildId: string, base: string): Promise<string> {
  const baseSlug = slugify(base) || 'torneo';
  let candidate = baseSlug;
  let n = 2;
  while (await prisma.tournament.findUnique({ where: { guildId_slug: { guildId, slug: candidate } } })) {
    candidate = `${baseSlug}-${n++}`;
  }
  return candidate;
}
