import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma, TournamentFormat } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild, upsertUser, uniqueTournamentSlug } from '../../lib/db-helpers.js';
import { tournamentRegistrationEmbed } from '../../lib/embeds.js';
import { registrationButtons } from '../../lib/components.js';
import { logger } from '../../lib/logger.js';

const formatChoices = [
  { name: 'Eliminación simple', value: 'SINGLE_ELIMINATION' as const },
  { name: 'Doble eliminación', value: 'DOUBLE_ELIMINATION' as const },
  { name: 'Round robin (todos contra todos)', value: 'ROUND_ROBIN' as const },
];

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Gestionar torneos del server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Crear un nuevo torneo')
        .addStringOption((o) =>
          o.setName('name').setDescription('Nombre del torneo').setRequired(true).setMaxLength(80),
        )
        .addStringOption((o) =>
          o
            .setName('format')
            .setDescription('Formato del bracket')
            .setRequired(true)
            .addChoices(...formatChoices),
        )
        .addIntegerOption((o) =>
          o
            .setName('max-participants')
            .setDescription('Máximo de participantes (default 32)')
            .setMinValue(2)
            .setMaxValue(256),
        )
        .addIntegerOption((o) =>
          o
            .setName('best-of')
            .setDescription('Mejor de N (BO1, BO3, BO5...)')
            .setMinValue(1)
            .setMaxValue(11),
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('Descripción opcional').setMaxLength(500),
        )
        .addStringOption((o) =>
          o
            .setName('seeding')
            .setDescription('Cómo emparejar (default: aleatorio)')
            .addChoices(
              { name: 'Aleatorio (recomendado)', value: 'RANDOM' },
              { name: 'Por orden de registro', value: 'REGISTRATION' },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName('team-size')
            .setDescription('Tamaño de equipo (1=solo, 2=2v2, 3=3v3, etc)')
            .setMinValue(1)
            .setMaxValue(5),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Listar torneos del server'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Cerrar registro y generar bracket')
        .addStringOption((o) =>
          o.setName('name').setDescription('Slug del torneo').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancelar un torneo')
        .addStringOption((o) =>
          o.setName('name').setDescription('Slug del torneo').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Ver detalle de un torneo (con participantes)')
        .addStringOption((o) =>
          o.setName('name').setDescription('Slug del torneo').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('checkin-open')
        .setDescription('Abrir ventana de check-in con timer')
        .addStringOption((o) =>
          o.setName('name').setDescription('Slug del torneo').setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('minutes')
            .setDescription('Duración del check-in (default 5)')
            .setMinValue(1)
            .setMaxValue(60),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('checkin-close')
        .setDescription('Cerrar check-in manualmente y descartar no-show')
        .addStringOption((o) =>
          o.setName('name').setDescription('Slug del torneo').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return handleCreate(interaction);
    if (sub === 'list') return handleList(interaction);
    if (sub === 'start') {
      const { handleStart } = await import('./start.js');
      return handleStart(interaction);
    }
    if (sub === 'cancel') return handleCancel(interaction);
    if (sub === 'view') return handleView(interaction);
    if (sub === 'checkin-open' || sub === 'checkin-close') {
      const { handleCheckin } = await import('./checkin.js');
      return handleCheckin(interaction);
    }
  },
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Solo se puede crear desde un server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const name = interaction.options.getString('name', true);
  const format = interaction.options.getString('format', true) as TournamentFormat;
  const maxParticipants = interaction.options.getInteger('max-participants') ?? 32;
  const bestOf = interaction.options.getInteger('best-of') ?? 1;
  const description = interaction.options.getString('description');
  const seeding = (interaction.options.getString('seeding') ?? 'RANDOM') as
    | 'RANDOM'
    | 'REGISTRATION';
  const teamSize = interaction.options.getInteger('team-size') ?? 1;

  if (format === 'SWISS') {
    await interaction.reply({
      content: 'El formato Suizo todavía no está implementado. Probá single elim, doble elim o round robin.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const guild = await upsertGuild(interaction.guild);
    const creator = await upsertUser(interaction.user);
    const slug = await uniqueTournamentSlug(guild.id, name);

    const tournament = await prisma.tournament.create({
      data: {
        guildId: guild.id,
        creatorId: creator.id,
        name,
        slug,
        description,
        format,
        status: 'REGISTRATION',
        maxParticipants,
        bestOf,
        teamSize,
        seedingMode: seeding,
        channelId: interaction.channelId,
      },
    });

    const components =
      teamSize > 1
        ? [(await import('../../lib/components.js')).teamButtons(tournament.id)]
        : [registrationButtons(tournament.id, 'REGISTRATION')];

    const message = await interaction.editReply({
      embeds: [tournamentRegistrationEmbed(tournament, [])],
      components,
    });

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { registrationMessageId: message.id },
    });

    logger.info({ tournamentId: tournament.id, slug }, 'Tournament created');
  } catch (err) {
    logger.error({ err }, 'Error creando torneo');
    await interaction.editReply({
      content: 'No pude crear el torneo. Mirá los logs.',
    });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Solo desde un server.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournaments = await prisma.tournament.findMany({
    where: { guildId: guild.id, status: { not: 'COMPLETED' } },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  if (tournaments.length === 0) {
    await interaction.editReply({ content: 'No hay torneos activos. `/tournament create` para crear uno.' });
    return;
  }

  const lines = tournaments.map(
    (t) =>
      `• **${t.name}** \`${t.slug}\` — ${t.status} · ${t._count.participants}/${t.maxParticipants}`,
  );
  await interaction.editReply({ content: lines.join('\n') });
}

async function handleCancel(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('name', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: 'CANCELLED' },
  });

  // Limpiar categoría + VCs si existen
  let vcMsg = '';
  if (tournament.voiceCategoryId) {
    const { deleteTournamentCategory } = await import('../../lib/voice.js');
    await deleteTournamentCategory(interaction.guild, tournament.voiceCategoryId);
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { voiceCategoryId: null },
    });
    vcMsg = ' (canales de voz borrados)';
  }

  await interaction.editReply({ content: `Torneo \`${tournament.slug}\` cancelado.${vcMsg}` });
}

async function handleView(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('name', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
    include: {
      participants: { include: { user: true }, orderBy: { registeredAt: 'asc' } },
    },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }
  await interaction.editReply({
    embeds: [tournamentRegistrationEmbed(tournament, tournament.participants)],
  });
}

export default command;
