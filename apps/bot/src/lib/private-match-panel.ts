import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from 'discord.js';
import { prisma } from '@camibot/db';

const SQUAD_LABEL: Record<number, string> = { 1: 'Solos', 2: 'Dúos', 3: 'Tríos', 4: 'Cuartetos' };

function nameOf(u: { nickname: string | null; globalName: string | null; username: string }): string {
  return u.nickname ?? u.globalName ?? u.username;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

/**
 * Arma el embed + botones de una privada. Se usa al crearla y al refrescar el
 * mensaje después de cada interacción. Devuelve null si ya no existe.
 */
export async function buildPrivadaPanel(matchId: string) {
  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    include: {
      signups: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, nickname: true, globalName: true, username: true } } },
      },
      squads: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!match) return null;

  const count = match.signups.length;
  const cupo = match.maxPlayers;
  const full = cupo != null && count >= cupo;
  const isTeams = match.squadSize > 1;
  const statusLabel =
    match.status === 'OPEN' ? (full ? 'LLENA' : 'ABIERTA') : match.status === 'CLOSED' ? 'CERRADA' : 'TERMINADA';

  const label = (s: (typeof match.signups)[number]) => {
    const n = nameOf(s.user);
    const cap = isTeams && match.squads.some((sq) => sq.captainId === s.userId) ? ' 👑' : '';
    const gid = s.gameId ? ` \`${s.gameId}\`` : '';
    return `${n}${cap}${gid}`;
  };

  const header = [
    match.prize ? `🏆 Premio: **${match.prize}**` : null,
    isTeams ? `👥 Modo: **${SQUAD_LABEL[match.squadSize] ?? `Equipos de ${match.squadSize}`}**` : null,
    match.scheduledAt
      ? `🕐 ${match.scheduledAt.toLocaleString('es-CL', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : null,
    match.link ? `🔗 [Entrar a la sala](${match.link})` : null,
    `Estado: **${statusLabel}**`,
  ]
    .filter(Boolean)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${match.name}`)
    .setColor(match.status === 'OPEN' ? 0x65a30d : 0x8a8676)
    .setDescription(header)
    .setTimestamp(match.createdAt);

  if (match.hasSignup) {
    if (!isTeams) {
      const roster = count
        ? truncate(match.signups.map((s, i) => `\`${String(i + 1).padStart(2, '0')}\` ${label(s)}`).join('\n'), 1024)
        : '_Nadie apuntado todavía_';
      embed.addFields({ name: `Apuntados (${count}${cupo != null ? `/${cupo}` : ''})`, value: roster });
    } else {
      for (const sq of match.squads.slice(0, 20)) {
        const members = match.signups.filter((s) => s.squadId === sq.id);
        const body = members.length
          ? truncate(members.map((s) => `• ${label(s)}`).join('\n'), 1024)
          : '_vacío_';
        embed.addFields({ name: `${sq.name} (${members.length}/${match.squadSize})`, value: body });
      }
      const teamless = match.signups.filter((s) => !s.squadId);
      if (teamless.length) {
        embed.addFields({ name: `Sin equipo (${teamless.length})`, value: truncate(teamless.map((s) => `• ${label(s)}`).join('\n'), 1024) });
      }
      if (!match.squads.length && !teamless.length) {
        embed.addFields({ name: 'Equipos', value: '_Todavía no hay equipos. Creá el primero._' });
      }
    }
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (match.hasSignup && match.status === 'OPEN') {
    if (!isTeams) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`privada:signup:${match.id}`)
            .setLabel('Me apunto')
            .setStyle(ButtonStyle.Success)
            .setDisabled(full),
          new ButtonBuilder().setCustomId(`privada:leave:${match.id}`).setLabel('Bajarme').setStyle(ButtonStyle.Danger),
        ),
      );
    } else {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`privada:team-create:${match.id}`)
            .setLabel('Crear equipo')
            .setStyle(ButtonStyle.Success)
            .setDisabled(full),
          new ButtonBuilder().setCustomId(`privada:team-join:${match.id}`).setLabel('Unirme').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`privada:leave:${match.id}`).setLabel('Salir').setStyle(ButtonStyle.Danger),
        ),
      );
    }
  }

  return { embed, rows };
}

/** Refresca el mensaje del panel de la privada en Discord, si está guardado. */
export async function refreshPrivadaPanel(client: Client, matchId: string): Promise<void> {
  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    select: { channelId: true, messageId: true },
  });
  if (!match?.channelId || !match.messageId) return;
  const channel = await client.channels.fetch(match.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !('messages' in channel)) return;
  const msg = await channel.messages.fetch(match.messageId).catch(() => null);
  if (!msg) return;
  const panel = await buildPrivadaPanel(matchId);
  if (!panel) return;
  await msg.edit({ embeds: [panel.embed], components: panel.rows }).catch(() => {});
}
