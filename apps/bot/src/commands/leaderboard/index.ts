import {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild } from '../../lib/db-helpers.js';

const DEFAULT_LEADERBOARD_NAME = 'General';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Ver tabla acumulada del server')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Mostrar el top de jugadores del server')
        .addIntegerOption((o) =>
          o
            .setName('limit')
            .setDescription('Cuántos jugadores mostrar (default 10)')
            .setMinValue(1)
            .setMaxValue(25),
        ),
    ),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'view') {
      await handleView(interaction);
    }
  },
};

async function handleView(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const limit = interaction.options.getInteger('limit') ?? 10;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const leaderboard = await prisma.leaderboard.findFirst({
    where: { guildId: guild.id, name: DEFAULT_LEADERBOARD_NAME, gameId: null },
    include: {
      entries: {
        orderBy: { points: 'desc' },
        take: limit,
        include: { user: true },
      },
    },
  });

  if (!leaderboard || leaderboard.entries.length === 0) {
    await interaction.editReply({
      content:
        'Todavía no hay leaderboard en este server. Se llena automáticamente cuando se completa el primer torneo.',
    });
    return;
  }

  const lines = leaderboard.entries.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${String(i + 1).padStart(2, '0')}\``;
    const name = e.user.globalName ?? e.user.username;
    return `${medal} **${name}** — ${e.points} pts · ${e.tournamentsWon}🏆 · ${e.wins}W/${e.losses}L · ${e.tournamentsPlayed} torneos`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Leaderboard — ${interaction.guild.name}`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2)
    .setFooter({
      text: `Top ${leaderboard.entries.length}. Puntos: 10 por torneo ganado, 3 por win, 1 por participar.`,
    });

  await interaction.editReply({ embeds: [embed] });
}

export default command;
