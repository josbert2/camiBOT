import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../lib/types.js';

const ping: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica que el bot responde'),
  async execute(interaction) {
    const sent = await interaction.reply({
      content: 'Pinging...',
      withResponse: true,
    });
    const latency =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp;
    await interaction.editReply(
      `Pong. Latencia: ${latency}ms · WS: ${interaction.client.ws.ping}ms`,
    );
  },
};

export default ping;
