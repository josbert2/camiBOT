import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';

export function registrationButtons(
  tournamentId: string,
  status: 'REGISTRATION' | 'CHECK_IN',
): APIActionRowComponent<APIButtonComponent> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (status === 'REGISTRATION') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tournament:register:${tournamentId}`)
        .setLabel('Registrarse')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tournament:unregister:${tournamentId}`)
        .setLabel('Salirse')
        .setStyle(ButtonStyle.Secondary),
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tournament:checkin:${tournamentId}`)
        .setLabel('Check-in')
        .setStyle(ButtonStyle.Success),
    );
  }

  return row.toJSON() as APIActionRowComponent<APIButtonComponent>;
}
