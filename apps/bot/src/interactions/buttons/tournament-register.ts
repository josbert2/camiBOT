import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { prisma, type Tournament } from '@camibot/db';
import { upsertUser } from '../../lib/db-helpers.js';
import { tournamentRegistrationEmbed } from '../../lib/embeds.js';
import { registrationButtons } from '../../lib/components.js';
import { logger } from '../../lib/logger.js';

type TournamentWithCount = Tournament & { _count: { participants: number } };

/**
 * customId: `tournament:register:{tournamentId}` | `tournament:unregister:{tournamentId}` | `tournament:checkin:{tournamentId}`
 */
export async function handleTournamentButton(interaction: ButtonInteraction) {
  const [, action, tournamentId] = interaction.customId.split(':');
  if (!tournamentId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { participants: true } } },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Este torneo ya no existe.' });
    return;
  }

  const user = await upsertUser(interaction.user);

  if (action === 'register') return doRegister(interaction, tournament, user.id);
  if (action === 'unregister') return doUnregister(interaction, tournament, user.id);
  if (action === 'checkin') return doCheckin(interaction, tournament, user.id);
  await interaction.editReply({ content: 'Acción desconocida.' });
}

async function doRegister(
  interaction: ButtonInteraction,
  tournament: TournamentWithCount,
  userId: string,
) {
  if (tournament.status !== 'REGISTRATION') {
    await interaction.editReply({ content: 'El registro está cerrado.' });
    return;
  }
  if (tournament._count.participants >= tournament.maxParticipants) {
    await interaction.editReply({ content: 'Cupo lleno.' });
    return;
  }

  const existing = await prisma.participant.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
  });
  if (existing) {
    await interaction.editReply({ content: 'Ya estás registrado.' });
    return;
  }

  await prisma.participant.create({
    data: { tournamentId: tournament.id, userId, status: 'REGISTERED' },
  });

  await refreshRegistrationMessage(interaction, tournament.id);
  await interaction.editReply({ content: '✓ Registrado. Te aviso cuando arranque.' });
  logger.info({ tournamentId: tournament.id, userId }, 'Participant registered');
}

async function doUnregister(
  interaction: ButtonInteraction,
  tournament: { id: string; status: string },
  userId: string,
) {
  if (tournament.status !== 'REGISTRATION' && tournament.status !== 'CHECK_IN') {
    await interaction.editReply({ content: 'No podés salir en este estado.' });
    return;
  }
  const existing = await prisma.participant.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
  });
  if (!existing) {
    await interaction.editReply({ content: 'No estás registrado.' });
    return;
  }
  await prisma.participant.delete({ where: { id: existing.id } });
  await refreshRegistrationMessage(interaction, tournament.id);
  await interaction.editReply({ content: 'Saliste del torneo.' });
}

async function doCheckin(
  interaction: ButtonInteraction,
  tournament: { id: string; status: string },
  userId: string,
) {
  if (tournament.status !== 'CHECK_IN') {
    await interaction.editReply({ content: 'El check-in no está abierto.' });
    return;
  }
  const existing = await prisma.participant.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
  });
  if (!existing) {
    await interaction.editReply({ content: 'No estás registrado.' });
    return;
  }
  await prisma.participant.update({
    where: { id: existing.id },
    data: { status: 'CHECKED_IN', checkedInAt: new Date() },
  });
  await interaction.editReply({ content: '✓ Check-in confirmado.' });
}

async function refreshRegistrationMessage(interaction: ButtonInteraction, tournamentId: string) {
  if (!interaction.message.editable) return;

  const updated = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: { include: { user: true }, orderBy: { registeredAt: 'asc' } } },
  });
  if (!updated) return;

  const status = updated.status === 'CHECK_IN' ? 'CHECK_IN' : 'REGISTRATION';
  await interaction.message
    .edit({
      embeds: [tournamentRegistrationEmbed(updated, updated.participants)],
      components: [registrationButtons(updated.id, status)],
    })
    .catch((err) => logger.warn({ err }, 'No pude editar mensaje de registro'));
}
