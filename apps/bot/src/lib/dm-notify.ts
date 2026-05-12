import { EmbedBuilder } from 'discord.js';
import { prisma } from '@camibot/db';
import { getDiscordClient } from './discord-client.js';
import { logger } from './logger.js';

/**
 * Manda DM a los 2 participantes de un match que pasó a READY.
 * Si el user tiene DMs cerrados, falla silencioso.
 * No envía a participantes fake (discord_id `dev_*`).
 */
export async function notifyMatchReady(matchId: string): Promise<void> {
  const client = getDiscordClient();
  if (!client) return;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { id: true, name: true, voiceCategoryId: true, format: true } },
        participant1: { include: { user: true } },
        participant2: { include: { user: true } },
      },
    });
    if (!match || match.status !== 'READY') return;
    if (!match.participant1 || !match.participant2) return;

    const webUrl = process.env.AUTH_URL ?? 'http://localhost:3001';
    const otherName = (
      p: NonNullable<typeof match.participant1>,
    ): string => p.user.globalName ?? p.user.username;

    const sendTo = async (
      me: NonNullable<typeof match.participant1>,
      opp: NonNullable<typeof match.participant1>,
    ) => {
      if (me.user.discordId.startsWith('dev_')) return;
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Tu match está listo`)
        .setColor(0x5865f2)
        .setDescription(
          `**${match.tournament.name}** — R${match.round}.${match.matchNumber}\n` +
            `**${otherName(me)}** vs **${otherName(opp)}**`,
        )
        .addFields({
          name: 'Cómo reportar',
          value:
            `\`/match report tournament:${match.tournament.id.slice(0, 8)}…\`` +
            `\nO usá el panel admin si te avisa el organizador.`,
        });

      if (match.voiceChannelId) {
        embed.addFields({
          name: 'Canal de voz',
          value: `<#${match.voiceChannelId}>`,
        });
      }
      embed.setURL(`${webUrl}/t/${match.tournament.id}`);

      try {
        const user = await client.users.fetch(me.user.discordId);
        await user.send({ embeds: [embed] });
      } catch (err) {
        logger.debug({ err, userId: me.user.discordId }, 'DM no se pudo enviar (probable DMs cerrados)');
      }
    };

    await Promise.allSettled([
      sendTo(match.participant1, match.participant2),
      sendTo(match.participant2, match.participant1),
    ]);
  } catch (err) {
    logger.warn({ err, matchId }, 'notifyMatchReady fallo');
  }
}
