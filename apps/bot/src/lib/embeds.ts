import { EmbedBuilder, type APIEmbed } from 'discord.js';
import type { Tournament, Participant, User } from '@camibot/db';

const COLOR_PRIMARY = 0x5865f2; // Discord blurple
const COLOR_SUCCESS = 0x57f287;
const COLOR_DANGER = 0xed4245;
const COLOR_MUTED = 0x2a2a2a;

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single elimination',
  DOUBLE_ELIMINATION: 'Double elimination',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Swiss',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  REGISTRATION: 'Registro abierto',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLOR: Record<string, number> = {
  DRAFT: COLOR_MUTED,
  REGISTRATION: COLOR_PRIMARY,
  CHECK_IN: 0xfee75c,
  IN_PROGRESS: COLOR_PRIMARY,
  COMPLETED: COLOR_SUCCESS,
  CANCELLED: COLOR_DANGER,
};

type ParticipantWithUser = Participant & { user: User };

export function tournamentRegistrationEmbed(
  tournament: Tournament,
  participants: ParticipantWithUser[] | Participant[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆  ${tournament.name}`)
    .setDescription(tournament.description ?? '_Sin descripción._')
    .setColor(STATUS_COLOR[tournament.status] ?? COLOR_PRIMARY)
    .addFields(
      { name: 'Formato', value: FORMAT_LABELS[tournament.format] ?? tournament.format, inline: true },
      { name: 'Estado', value: STATUS_LABELS[tournament.status] ?? tournament.status, inline: true },
      {
        name: 'Cupo',
        value: `${participants.length} / ${tournament.maxParticipants}`,
        inline: true,
      },
      {
        name: 'Best of',
        value: `BO${tournament.bestOf}`,
        inline: true,
      },
    );

  // Lista de participantes (si vienen con user, mostramos nombres)
  if (participants.length > 0 && 'user' in participants[0]!) {
    const list = participants as ParticipantWithUser[];
    const lines = list.map((p, i) => {
      const name = p.user.globalName ?? p.user.username;
      const mention = p.user.discordId.startsWith('dev_')
        ? `\`${name}\``
        : `<@${p.user.discordId}>`;
      const tag = p.status === 'CHECKED_IN' ? ' ✓' : '';
      return `\`${String(i + 1).padStart(2, '0')}\` ${mention}${tag}`;
    });
    // Discord embed field: max 1024 chars. Si pasa, truncamos.
    const value = lines.join('\n');
    embed.addFields({
      name: `Participantes (${list.length})`,
      value: value.length > 1024 ? value.slice(0, 1000) + '\n... y más' : value,
    });
  }

  embed.setFooter({ text: `slug: ${tournament.slug}` }).setTimestamp(tournament.updatedAt);
  return embed;
}

export function bracketEmbed(tournamentName: string, bracketText: string): APIEmbed {
  return new EmbedBuilder()
    .setTitle(`🔥  Bracket — ${tournamentName}`)
    .setDescription(bracketText.slice(0, 4000))
    .setColor(COLOR_PRIMARY)
    .toJSON();
}
