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
import { applyMatchResult } from '../../lib/match-result.js';

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
    )
    .addSubcommand((sub) =>
      sub
        .setName('simulate-match')
        .setDescription('Cierra el próximo match READY con ganador aleatorio')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('simulate-all')
        .setDescription('Simula todos los matches restantes con ganadores aleatorios')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('win-seed')
        .setDescription('El participante con seed N gana su próximo match READY')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('seed')
            .setDescription('Seed del participante que gana')
            .setRequired(true)
            .setMinValue(1),
        ),
    ),

  async execute(interaction) {
    // Gate por admin Discord ID. La env var ADMIN_DISCORD_IDS (CSV) tiene
    // los IDs habilitados. Si no está seteada y NODE_ENV=production, bloqueamos.
    const adminIds = (process.env.ADMIN_DISCORD_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdminUser = adminIds.includes(interaction.user.id);
    if (!isAdminUser) {
      await interaction.reply({
        content:
          '`/dev` solo está disponible para admins. Pedile al owner que te agregue a `ADMIN_DISCORD_IDS`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'seed-participants') return handleSeed(interaction);
    if (sub === 'cleanup') return handleCleanup(interaction);
    if (sub === 'wipe-fake-users') return handleWipe(interaction);
    if (sub === 'simulate-match') return handleSimulateMatch(interaction);
    if (sub === 'simulate-all') return handleSimulateAll(interaction);
    if (sub === 'win-seed') return handleWinSeed(interaction);
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

async function handleSimulateMatch(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament || tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: 'Torneo no encontrado o no está en curso.' });
    return;
  }

  const nextReady = await prisma.match.findFirst({
    where: { tournamentId: tournament.id, status: 'READY' },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });
  if (!nextReady || !nextReady.participant1Id || !nextReady.participant2Id) {
    await interaction.editReply({ content: 'No hay matches READY para simular.' });
    return;
  }

  const winnerId = Math.random() < 0.5 ? nextReady.participant1Id : nextReady.participant2Id;
  const winnerParticipant = await prisma.participant.findUnique({
    where: { id: winnerId },
    include: { user: true },
  });
  try {
    const outcome = await applyMatchResult({
      tournamentId: tournament.id,
      matchId: nextReady.id,
      winnerId,
    });
    const wname = winnerParticipant?.user.globalName ?? winnerParticipant?.user.username ?? '?';
    await interaction.editReply({
      content: `✓ Match \`R${nextReady.round}.${nextReady.matchNumber}\`: gana **${wname}** (seed ${winnerParticipant?.seed}).${outcome.tournamentDone ? `\n🏁 Torneo terminado.${outcome.extraNote}` : ''}`,
    });
  } catch (err) {
    await interaction.editReply({
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function handleSimulateAll(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament || tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: 'Torneo no encontrado o no está en curso.' });
    return;
  }

  // Safety: max 500 matches por simulación
  const MAX_ITER = 500;
  let played = 0;
  let done = false;
  let extraNote = '';
  let lastWinnerName = '';
  for (let i = 0; i < MAX_ITER; i++) {
    const next = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, status: 'READY' },
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    });
    if (!next || !next.participant1Id || !next.participant2Id) break;
    const winnerId = Math.random() < 0.5 ? next.participant1Id : next.participant2Id;
    const outcome = await applyMatchResult({
      tournamentId: tournament.id,
      matchId: next.id,
      winnerId,
    });
    played++;
    if (outcome.tournamentDone) {
      done = true;
      extraNote = outcome.extraNote;
      const winner = await prisma.participant.findUnique({
        where: { id: winnerId },
        include: { user: true },
      });
      lastWinnerName = winner?.user.globalName ?? winner?.user.username ?? '?';
      break;
    }
  }

  const tStatus = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    select: { status: true },
  });

  if (done) {
    // Buscar al WINNER si no lo capturé arriba
    if (!lastWinnerName) {
      const winnerP = await prisma.participant.findFirst({
        where: { tournamentId: tournament.id, status: 'WINNER' },
        include: { user: true },
      });
      lastWinnerName = winnerP?.user.globalName ?? winnerP?.user.username ?? '?';
    }
    await interaction.editReply({
      content: `🏁 Torneo simulado: ${played} matches jugados. **Campeón: ${lastWinnerName}**.${extraNote}`,
    });
  } else {
    await interaction.editReply({
      content: `Simulados ${played} matches. Torneo en estado ${tStatus?.status}.`,
    });
  }
}

async function handleWinSeed(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  const seed = interaction.options.getInteger('seed', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament || tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: 'Torneo no encontrado o no está en curso.' });
    return;
  }

  const participant = await prisma.participant.findFirst({
    where: { tournamentId: tournament.id, seed },
    include: { user: true },
  });
  if (!participant) {
    await interaction.editReply({ content: `No hay participante con seed ${seed}.` });
    return;
  }

  const readyMatch = await prisma.match.findFirst({
    where: {
      tournamentId: tournament.id,
      status: 'READY',
      OR: [{ participant1Id: participant.id }, { participant2Id: participant.id }],
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });
  if (!readyMatch) {
    await interaction.editReply({
      content: `Seed ${seed} (${participant.user.globalName ?? participant.user.username}) no tiene matches READY.`,
    });
    return;
  }

  try {
    const outcome = await applyMatchResult({
      tournamentId: tournament.id,
      matchId: readyMatch.id,
      winnerId: participant.id,
    });
    const pname = participant.user.globalName ?? participant.user.username;
    await interaction.editReply({
      content: `✓ Match \`R${readyMatch.round}.${readyMatch.matchNumber}\`: gana **${pname}** (seed ${seed}).${outcome.tournamentDone ? `\n🏁 Torneo terminado.${outcome.extraNote}` : ''}`,
    });
  } catch (err) {
    await interaction.editReply({
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
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
