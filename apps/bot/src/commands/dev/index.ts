import {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild } from '../../lib/db-helpers.js';
import { tournamentRegistrationEmbed } from '../../lib/embeds.js';
import { registrationButtons } from '../../lib/components.js';
import { logger } from '../../lib/logger.js';

const DEV_PREFIX = 'dev_';
const FAKE_NAMES = [
  'Aiden', 'Bree', 'Caleb', 'Dana', 'Eliot', 'Frey', 'Goa', 'Hex',
  'Ivy', 'Jax', 'Kira', 'Lux', 'Mara', 'Nox', 'Onyx', 'Pia',
  'Quin', 'Rune', 'Sage', 'Tess', 'Uma', 'Vex', 'Wren', 'Xan',
  'Yara', 'Zed', 'Aria', 'Bolt', 'Cora', 'Drew', 'Echo', 'Fox',
];

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('Comandos solo-dev (no usar en producción)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('seed-participants')
        .setDescription('Agregar N participantes fake a un torneo (testing)')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('count')
            .setDescription('Cantidad de participantes a crear')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(32),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cleanup')
        .setDescription('Borra todos los participantes fake de un torneo'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('wipe-fake-users')
        .setDescription('Borra TODOS los usuarios fake de la DB (cuidado)'),
    ),

  async execute(interaction) {
    if (process.env.NODE_ENV === 'production') {
      await interaction.reply({
        content: '`/dev` deshabilitado en producción.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'seed-participants') return handleSeed(interaction);
    if (sub === 'cleanup') return handleCleanup(interaction);
    if (sub === 'wipe-fake-users') return handleWipe(interaction);
  },
};

async function handleSeed(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  const count = interaction.options.getInteger('count', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
    include: { _count: { select: { participants: true } } },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }
  if (tournament.status !== 'REGISTRATION') {
    await interaction.editReply({
      content: `Estado del torneo es \`${tournament.status}\`, no se pueden agregar participantes.`,
    });
    return;
  }
  const remaining = tournament.maxParticipants - tournament._count.participants;
  if (count > remaining) {
    await interaction.editReply({
      content: `Solo quedan ${remaining} cupos.`,
    });
    return;
  }

  // Generar usuarios fake con discordId determinístico
  const startIdx =
    (await prisma.user.count({ where: { discordId: { startsWith: DEV_PREFIX } } })) + 1;

  const created: { username: string }[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const baseName = FAKE_NAMES[i % FAKE_NAMES.length] ?? `dev${idx}`;
    const username = `${baseName.toLowerCase()}_${idx}`;
    const discordId = `${DEV_PREFIX}${idx}`;

    const user = await prisma.user.upsert({
      where: { discordId },
      update: { username, globalName: baseName },
      create: { discordId, username, globalName: baseName },
    });

    await prisma.participant.create({
      data: { tournamentId: tournament.id, userId: user.id, status: 'REGISTERED' },
    });
    created.push({ username });
  }

  // Refrescar el mensaje de registro si existe
  await refreshRegistrationMessage(interaction, tournament.id);

  await interaction.editReply({
    content: `✓ Agregados ${created.length} participantes fake:\n${created
      .map((c) => `• ${c.username}`)
      .join('\n')}`,
  });
  logger.info({ tournamentId: tournament.id, count }, 'Dev: seed participants');
}

async function handleCleanup(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const fakeParticipants = await prisma.participant.findMany({
    where: {
      tournament: { guildId: guild.id },
      user: { discordId: { startsWith: DEV_PREFIX } },
    },
    select: { id: true, tournamentId: true },
  });

  const tournamentIds = new Set(fakeParticipants.map((p) => p.tournamentId));
  await prisma.participant.deleteMany({
    where: { id: { in: fakeParticipants.map((p) => p.id) } },
  });

  // Refrescar todos los embeds afectados
  for (const tid of tournamentIds) {
    await refreshRegistrationMessage(interaction, tid).catch(() => {});
  }

  await interaction.editReply({
    content: `✓ Borrados ${fakeParticipants.length} participantes fake de ${tournamentIds.size} torneo(s).`,
  });
}

async function handleWipe(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const deleted = await prisma.user.deleteMany({
    where: { discordId: { startsWith: DEV_PREFIX } },
  });
  await interaction.editReply({
    content: `✓ Borrados ${deleted.count} usuarios fake.`,
  });
}

async function refreshRegistrationMessage(
  interaction: ChatInputCommandInteraction,
  tournamentId: string,
) {
  const updated = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: { include: { user: true }, orderBy: { registeredAt: 'asc' } } },
  });
  if (!updated?.registrationMessageId || !updated.channelId) return;

  const channel = await interaction.client.channels
    .fetch(updated.channelId)
    .catch(() => null);
  if (!channel || !channel.isTextBased() || !('messages' in channel)) return;

  const msg = await channel.messages.fetch(updated.registrationMessageId).catch(() => null);
  if (!msg) return;

  const status = updated.status === 'CHECK_IN' ? 'CHECK_IN' : 'REGISTRATION';
  await msg
    .edit({
      embeds: [tournamentRegistrationEmbed(updated, updated.participants)],
      components: [registrationButtons(updated.id, status)],
    })
    .catch((err) => logger.warn({ err }, 'No pude editar mensaje de registro'));
}

export default command;
