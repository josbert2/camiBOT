import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@camibot/db';
import { upsertGuild } from '../../lib/db-helpers.js';
import { tournamentRegistrationEmbed } from '../../lib/embeds.js';
import { registrationButtons } from '../../lib/components.js';
import { logger } from '../../lib/logger.js';

// Timers en memoria — si reinicia el bot, admin debe cerrar manual con /tournament checkin-close.
const timers = new Map<string, NodeJS.Timeout>();

export async function handleCheckin(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'checkin-open') return handleOpen(interaction);
  if (sub === 'checkin-close') return handleClose(interaction);
}

async function handleOpen(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('name', true);
  const minutes = interaction.options.getInteger('minutes') ?? 5;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }
  if (tournament.status !== 'REGISTRATION') {
    await interaction.editReply({
      content: `Solo se puede abrir check-in desde REGISTRATION. Estado actual: ${tournament.status}.`,
    });
    return;
  }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: 'CHECK_IN' },
  });

  await refreshRegistrationMessage(interaction, tournament.id);

  const closesAt = new Date(Date.now() + minutes * 60_000);
  const unix = Math.floor(closesAt.getTime() / 1000);

  // Cancelar timer anterior si existe
  const prev = timers.get(tournament.id);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(
    () => {
      closeCheckin(tournament.id, interaction).catch((err) =>
        logger.warn({ err, tournamentId: tournament.id }, 'auto-close fallo'),
      );
    },
    minutes * 60_000,
  );
  timers.set(tournament.id, timer);

  await interaction.editReply({
    content: `✓ Check-in abierto. Cierra <t:${unix}:R> (a las <t:${unix}:t>).\nQuienes no clickeen "Check-in" antes serán descartados.`,
  });
  logger.info({ tournamentId: tournament.id, minutes }, 'Check-in abierto');
}

async function handleClose(interaction: ChatInputCommandInteraction) {
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

  const summary = await closeCheckinNow(tournament.id);
  await refreshRegistrationMessage(interaction, tournament.id);
  await interaction.editReply({
    content: `✓ Check-in cerrado: ${summary.confirmed} confirmados, ${summary.dropped} descartados. Listos para \`/tournament start name:${slug}\`.`,
  });
}

async function closeCheckin(tournamentId: string, interaction: ChatInputCommandInteraction) {
  await closeCheckinNow(tournamentId);
  await refreshRegistrationMessage(interaction, tournamentId);
  timers.delete(tournamentId);
}

async function closeCheckinNow(
  tournamentId: string,
): Promise<{ confirmed: number; dropped: number }> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: true },
  });
  if (!t) return { confirmed: 0, dropped: 0 };
  if (t.status !== 'CHECK_IN') return { confirmed: 0, dropped: 0 };

  const dropped = t.participants.filter((p) => p.status !== 'CHECKED_IN');
  const confirmed = t.participants.length - dropped.length;

  if (dropped.length > 0) {
    await prisma.participant.deleteMany({
      where: { id: { in: dropped.map((p) => p.id) } },
    });
  }
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'REGISTRATION' }, // listo para /start
  });

  logger.info({ tournamentId, confirmed, dropped: dropped.length }, 'Check-in cerrado');
  return { confirmed, dropped: dropped.length };
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
