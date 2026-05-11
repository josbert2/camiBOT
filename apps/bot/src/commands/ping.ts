import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../lib/types.js';

const ping: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica que el bot responde'),
  async execute(interaction) {
    await interaction.reply({
      content: `Pong. WS: ${interaction.client.ws.ping}ms`,
    });
  },
};

export default ping;
