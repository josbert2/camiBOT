import { EmbedBuilder, ChannelType } from 'discord.js';
import { prisma } from '@camibot/db';
import { getDiscordClient } from './discord-client.js';
import { logger } from './logger.js';

/**
 * Si el ganador del match queda con una racha >= 3 que iguala o supera su récord
 * histórico, postea un mensaje al canal de anuncios.
 *
 * "Igual o supera": evita spam al recalcular en el mismo nivel — solo se dispara
 * cuando se cruza un milestone nuevo (current === best).
 */
export async function announceStreakIfMilestone(
  winnerParticipantId: string,
): Promise<void> {
  const channelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId) return;
  const client = getDiscordClient();
  if (!client) return;

  try {
    const winner = await prisma.participant.findUnique({
      where: { id: winnerParticipantId },
      include: { user: true },
    });
    if (!winner || winner.user.discordId.startsWith('dev_')) return;

    // Todos los matches COMPLETED donde participó este user (cross-torneos)
    const userParticipantIds = await prisma.participant
      .findMany({
        where: { userId: winner.userId },
        select: { id: true },
      })
      .then((ps) => ps.map((p) => p.id));

    const matches = await prisma.match.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { participant1Id: { in: userParticipantIds } },
          { participant2Id: { in: userParticipantIds } },
        ],
      },
      select: { winnerId: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    const mine = new Set(userParticipantIds);
    // current
    let current = 0;
    for (const m of matches) {
      if (!m.winnerId) break;
      if (mine.has(m.winnerId)) current++;
      else break;
    }
    if (current < 3) return;

    // best (recorrer asc)
    const asc = [...matches].reverse();
    let best = 0;
    let run = 0;
    for (const m of asc) {
      if (m.winnerId && mine.has(m.winnerId)) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }

    if (current !== best) return; // solo anunciar al cruzar récord
    // Y solo en milestones: 3, 5, 10, 15, 20, 25...
    const milestones = [3, 5, 10, 15, 20, 25, 30, 50];
    if (!milestones.includes(current)) return;

    const name = winner.user.globalName ?? winner.user.username;
    const fire = current >= 10 ? '⚡' : '🔥';
    const webUrl = process.env.AUTH_URL ?? 'http://localhost:3001';

    const embed = new EmbedBuilder()
      .setTitle(`${fire} ${name} lleva ${current} wins seguidos!`)
      .setColor(0xfee75c)
      .setDescription(
        `Nuevo récord personal de **${name}** — ${current} matches sin perder.`,
      )
      .setURL(`${webUrl}/players/${winner.userId}`)
      .setFooter({ text: `tournify.josbert.dev/players/${winner.userId}` })
      .setTimestamp(new Date());

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (
      !channel ||
      (channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildAnnouncement &&
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread)
    ) {
      return;
    }
    await channel.send({ embeds: [embed] });
    logger.info({ userId: winner.userId, streak: current }, 'Streak milestone announced');
  } catch (err) {
    logger.warn({ err, winnerParticipantId }, 'Streak announce fallo');
  }
}
