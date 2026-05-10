import { EmbedBuilder, type APIEmbed } from 'discord.js';
import type { Tournament, Participant } from '@camibot/db';

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

export function tournamentRegistrationEmbed(
  tournament: Tournament,
  participants: Participant[],
): EmbedBuilder {
  return new EmbedBuilder()
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
    )
    .setFooter({ text: `ID: ${tournament.id}` })
    .setTimestamp(tournament.updatedAt);
}

export function bracketEmbed(tournamentName: string, bracketText: string): APIEmbed {
  return new EmbedBuilder()
    .setTitle(`🔥  Bracket — ${tournamentName}`)
    .setDescription(bracketText.slice(0, 4000))
    .setColor(COLOR_PRIMARY)
    .toJSON();
}
