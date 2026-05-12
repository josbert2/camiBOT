import { EmbedBuilder, ChannelType } from 'discord.js';
import { prisma } from '@camibot/db';
import { getDiscordClient } from './discord-client.js';
import { logger } from './logger.js';

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIMINATION: 'Eliminación simple',
  DOUBLE_ELIMINATION: 'Doble eliminación',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Suizo',
};

/**
 * Postea un embed celebratorio cuando un torneo se completa.
 * Va al canal `ANNOUNCEMENTS_CHANNEL_ID` si está configurado.
 */
export async function announceTournamentCompletion(tournamentId: string): Promise<void> {
  const channelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId) return;

  const client = getDiscordClient();
  if (!client) return;

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: { user: true },
          orderBy: [{ finalRank: 'asc' }, { seed: 'asc' }],
        },
        guild: { select: { name: true } },
      },
    });
    if (!tournament || tournament.status !== 'COMPLETED') return;

    // Numeración secuencial por guild (cuenta cuántos torneos completados hay
    // hasta este — incluyéndolo).
    const endedAt = tournament.endedAt ?? new Date();
    const tournamentNumber = await prisma.tournament.count({
      where: {
        guildId: tournament.guildId,
        status: 'COMPLETED',
        endedAt: { lte: endedAt },
      },
    });

    // "Semana del DD/MM/YYYY" — lunes de la semana en que terminó.
    const monday = new Date(endedAt);
    const day = monday.getDay();
    const diff = (day + 6) % 7; // lunes = 0
    monday.setDate(monday.getDate() - diff);
    const weekLabel = monday.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const winner = tournament.participants.find((p) => p.status === 'WINNER');
    const podium = tournament.participants
      .filter((p) => p.finalRank && p.finalRank <= 3)
      .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));

    const medal = (rank: number) =>
      rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const nameOf = (p: (typeof tournament.participants)[number]) =>
      p.user.globalName ?? p.user.username;

    const podiumText = podium.length
      ? podium.map((p) => `${medal(p.finalRank ?? 0)} **${nameOf(p)}** · ${p.wins}W·${p.losses}L`).join('\n')
      : winner
        ? `🥇 **${nameOf(winner)}** · ${winner.wins}W·${winner.losses}L`
        : '_Sin ganador determinado_';

    const participantList = tournament.participants
      .map((p) => {
        const tag =
          p.status === 'WINNER'
            ? '🏆 '
            : p.finalRank
              ? `#${p.finalRank} `
              : '';
        return `\`${String(p.seed ?? '–').padStart(2, '0')}\` ${tag}${nameOf(p)} · ${p.wins}W·${p.losses}L`;
      })
      .join('\n');

    const webUrl = process.env.AUTH_URL ?? 'http://localhost:3001';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Torneo #${tournamentNumber} — ${tournament.name}`)
      .setDescription(
        `Semana del ${weekLabel}\n\n${
          winner
            ? `**¡${nameOf(winner)} es el campeón!** 🎉`
            : 'Torneo finalizado.'
        }`,
      )
      .setColor(0xfee75c)
      .addFields(
        { name: 'Podio', value: podiumText, inline: false },
        {
          name: `Participantes (${tournament.participants.length})`,
          value: truncate(participantList, 1000) || '_vacío_',
          inline: false,
        },
        {
          name: 'Info',
          value: `Formato: ${FORMAT_LABEL[tournament.format] ?? tournament.format}\nServer: ${tournament.guild.name}`,
          inline: false,
        },
      )
      .setURL(`${webUrl}/t/${tournament.id}`)
      .setFooter({ text: `tournify.josbert.dev/t/${tournament.id}` })
      .setTimestamp(tournament.endedAt ?? new Date());

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      logger.warn({ channelId }, 'Announcements channel no encontrado');
      return;
    }
    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement &&
      channel.type !== ChannelType.PublicThread &&
      channel.type !== ChannelType.PrivateThread
    ) {
      logger.warn({ channelId, type: channel.type }, 'Announcements channel no es texteable');
      return;
    }
    await channel.send({ embeds: [embed] });

    logger.info({ tournamentId, channelId }, 'Tournament announced');
  } catch (err) {
    logger.warn({ err, tournamentId }, 'No pude anunciar el torneo');
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}
