import { Events, MessageFlags, type Client } from 'discord.js';
import { logger } from '../lib/logger.js';
import { commandMap } from '../commands/index.js';
import { upsertGuild } from '../lib/db-helpers.js';
import { handleTournamentButton } from '../interactions/buttons/tournament-register.js';
import { handleMatchAdminButton } from '../interactions/buttons/match-admin.js';
import {
  handleTeamButton,
  handleTeamModalSubmit,
  handleTeamSelect,
} from '../interactions/buttons/tournament-team.js';

export function registerEvents(client: Client) {
  client.once(Events.ClientReady, (c) => {
    logger.info(`Bot listo. Logged in as ${c.user.tag} en ${c.guilds.cache.size} guilds.`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commandMap.get(interaction.commandName);
        if (!cmd) {
          logger.warn(`Comando desconocido: ${interaction.commandName}`);
          return;
        }
        await cmd.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('tournament:team-')) {
          await handleTeamButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('tournament:')) {
          await handleTournamentButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('match:')) {
          await handleMatchAdminButton(interaction);
          return;
        }
        logger.warn({ customId: interaction.customId }, 'Botón sin handler');
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('tournament:team-create-submit:')) {
          await handleTeamModalSubmit(interaction);
          return;
        }
      }

      if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('tournament:team-join-select:')) {
          await handleTeamSelect(interaction);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error en interaction');
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: 'Ocurrió un error procesando esta interacción.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    logger.info(`Bot agregado al guild: ${guild.name} (${guild.id})`);
    await upsertGuild(guild).catch((err) =>
      logger.error({ err }, 'Fallo upsert guild en GuildCreate'),
    );
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, 'Discord client error');
  });
}
