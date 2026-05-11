import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type CategoryChannel,
  type VoiceChannel,
} from 'discord.js';
import { logger } from './logger.js';

export interface MatchVCInfo {
  matchId: string;
  matchNumber: number;
  round: number;
  totalRounds: number;
  p1Name: string;
  p2Name: string;
}

/** Crea la categoría del torneo donde van todos los VCs. */
export async function createTournamentCategory(
  guild: Guild,
  tournamentName: string,
): Promise<CategoryChannel> {
  return guild.channels.create({
    name: `🏆 ${truncate(tournamentName, 80)}`,
    type: ChannelType.GuildCategory,
    reason: `Categoría del torneo: ${tournamentName}`,
  });
}

/** Crea un VC para un match dado, bajo la categoría del torneo. */
export async function createMatchVoiceChannel(
  guild: Guild,
  categoryId: string,
  info: MatchVCInfo,
): Promise<VoiceChannel> {
  const channelName = matchChannelName(info);
  return guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: categoryId,
    userLimit: 4, // 2 jugadores + 2 espectadores
    reason: `Match ${info.matchNumber} round ${info.round}`,
  });
}

/** Renombra un VC cuando los participantes cambian (avance de bracket). */
export async function renameMatchVoiceChannel(
  guild: Guild,
  channelId: string,
  info: MatchVCInfo,
): Promise<void> {
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildVoice) return;
  await ch.setName(matchChannelName(info)).catch((err) =>
    logger.warn({ err, channelId }, 'No pude renombrar VC'),
  );
}

/** Borra la categoría del torneo y todos los VCs adentro. */
export async function deleteTournamentCategory(guild: Guild, categoryId: string): Promise<void> {
  const category = await guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) return;

  // Borrar todos los children primero
  const cat = category as CategoryChannel;
  const children = [...cat.children.cache.values()];
  for (const child of children) {
    await child.delete(`Cleanup del torneo`).catch((err) =>
      logger.warn({ err, channelId: child.id }, 'No pude borrar VC'),
    );
  }

  await category.delete('Cleanup del torneo').catch((err) =>
    logger.warn({ err, categoryId }, 'No pude borrar categoría'),
  );
}

/** Nombre del VC para un match. Discord limita a 100 chars. */
function matchChannelName(info: MatchVCInfo): string {
  const label = roundLabel(info.round, info.totalRounds);
  const p1 = truncate(info.p1Name, 20);
  const p2 = truncate(info.p2Name, 20);
  return truncate(`${label}: ${p1} vs ${p2}`, 95);
}

function roundLabel(round: number, total: number): string {
  if (round === total) return 'Final';
  if (round === total - 1) return 'SF';
  if (round === total - 2) return 'QF';
  return `R${round}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Verifica que el bot tiene permisos para gestionar canales en el guild. */
export function canManageChannels(guild: Guild): boolean {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(PermissionFlagsBits.ManageChannels);
}

/** Verifica que el bot puede mover miembros entre VCs. */
export function canMoveMembers(guild: Guild): boolean {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(PermissionFlagsBits.MoveMembers);
}

/**
 * Intenta mover a un usuario a un VC.
 * - Si el usuario está en algún VC → lo mueve.
 * - Si no está en voice → no hace nada (Discord no permite "convocar").
 * - Si el discordId es fake (dev), no hace nada.
 * Devuelve true si efectivamente movió.
 */
export async function tryMoveToVoice(
  guild: Guild,
  discordId: string,
  channelId: string,
): Promise<boolean> {
  if (discordId.startsWith('dev_')) return false;
  try {
    const member = await guild.members.fetch(discordId);
    if (!member.voice.channelId) return false; // no está en voice
    await member.voice.setChannel(channelId, 'Match del torneo');
    return true;
  } catch (err) {
    logger.warn({ err, discordId, channelId }, 'No pude mover al VC');
    return false;
  }
}
