import {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import { upsertUser } from '../../lib/db-helpers.js';
import { tournamentRegistrationEmbed } from '../../lib/embeds.js';
import { teamButtons } from '../../lib/components.js';
import { logger } from '../../lib/logger.js';

/**
 * customId del flow de teams:
 *   `tournament:team-create:{tournamentId}`      → abrir modal "nombre del equipo"
 *   `tournament:team-join:{tournamentId}`        → mostrar select con equipos incompletos
 *   `tournament:team-leave:{tournamentId}`       → salir del equipo (captain → borra team)
 *   `tournament:team-create-submit:{tournamentId}` (modal submit)
 *   `tournament:team-join-select:{tournamentId}` (select menu submit)
 */
export async function handleTeamButton(interaction: ButtonInteraction) {
  const [, action, tournamentId] = interaction.customId.split(':');
  if (!tournamentId) return;
  if (action === 'team-create') return showCreateModal(interaction, tournamentId);
  if (action === 'team-join') return showJoinSelect(interaction, tournamentId);
  if (action === 'team-leave') return doLeave(interaction, tournamentId);
}

export async function handleTeamModalSubmit(interaction: ModalSubmitInteraction) {
  const [, , tournamentId] = interaction.customId.split(':');
  if (!tournamentId) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const teamName = interaction.fields.getTextInputValue('team-name').trim();
  if (!teamName || teamName.length < 2) {
    await interaction.editReply({ content: 'Nombre muy corto.' });
    return;
  }

  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { participants: true } } },
  });
  if (!t || t.status !== 'REGISTRATION') {
    await interaction.editReply({ content: 'Registro cerrado.' });
    return;
  }
  if (t._count.participants >= t.maxParticipants) {
    await interaction.editReply({ content: 'Cupo de equipos lleno.' });
    return;
  }

  const user = await upsertUser(interaction.user);

  // Ya está en algún equipo?
  const existing = await prisma.participant.findFirst({
    where: {
      tournamentId,
      OR: [
        { userId: user.id },
        // teammates es JSON array de userIds; usamos contains string
      ],
    },
  });
  if (existing) {
    await interaction.editReply({ content: 'Ya estás en un equipo de este torneo.' });
    return;
  }

  await prisma.participant.create({
    data: {
      tournamentId,
      userId: user.id,
      teamName,
      teammates: [],
      status: 'REGISTERED',
    },
  });

  await refreshRegistration(interaction, tournamentId);
  await interaction.editReply({
    content: `✓ Equipo **${teamName}** creado. Sos el capitán. Compartí el torneo para que se sumen.`,
  });
}

export async function handleTeamSelect(interaction: StringSelectMenuInteraction) {
  const [, , tournamentId] = interaction.customId.split(':');
  if (!tournamentId) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const teamParticipantId = interaction.values[0];
  if (!teamParticipantId) {
    await interaction.editReply({ content: 'No elegiste equipo.' });
    return;
  }

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t || t.status !== 'REGISTRATION') {
    await interaction.editReply({ content: 'Registro cerrado.' });
    return;
  }

  const team = await prisma.participant.findUnique({
    where: { id: teamParticipantId },
  });
  if (!team) {
    await interaction.editReply({ content: 'Equipo no encontrado.' });
    return;
  }

  const teammates = Array.isArray(team.teammates) ? (team.teammates as string[]) : [];
  if (1 + teammates.length >= t.teamSize) {
    await interaction.editReply({ content: 'Ese equipo ya está completo.' });
    return;
  }

  const user = await upsertUser(interaction.user);

  // Ya está en otro equipo?
  const existing = await prisma.participant.findFirst({
    where: { tournamentId, userId: user.id },
  });
  if (existing) {
    await interaction.editReply({ content: 'Ya estás en un equipo de este torneo.' });
    return;
  }
  if (teammates.includes(user.id)) {
    await interaction.editReply({ content: 'Ya estabas en ese equipo.' });
    return;
  }

  await prisma.participant.update({
    where: { id: team.id },
    data: { teammates: [...teammates, user.id] },
  });

  await refreshRegistration(interaction, tournamentId);
  await interaction.editReply({
    content: `✓ Te uniste al equipo **${team.teamName}**.`,
  });
}

async function showCreateModal(interaction: ButtonInteraction, tournamentId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`tournament:team-create-submit:${tournamentId}`)
    .setTitle('Crear equipo')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('team-name')
          .setLabel('Nombre del equipo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40)
          .setMinLength(2),
      ),
    );
  await interaction.showModal(modal);
}

async function showJoinSelect(interaction: ButtonInteraction, tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: { include: { user: true } } },
  });
  if (!t) {
    await interaction.reply({ content: 'Torneo no encontrado.', flags: MessageFlags.Ephemeral });
    return;
  }
  const open = t.participants.filter((p) => {
    const tm = Array.isArray(p.teammates) ? (p.teammates as string[]) : [];
    return 1 + tm.length < t.teamSize;
  });
  if (open.length === 0) {
    await interaction.reply({
      content: 'No hay equipos con cupo. Crea uno con "Crear equipo".',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`tournament:team-join-select:${tournamentId}`)
    .setPlaceholder('Elegí equipo')
    .addOptions(
      open.slice(0, 25).map((p) => {
        const tm = Array.isArray(p.teammates) ? (p.teammates as string[]) : [];
        const captain = p.user.globalName ?? p.user.username;
        return {
          label: `${p.teamName ?? 'Sin nombre'} (${1 + tm.length}/${t.teamSize})`,
          description: `Capitán: ${captain}`,
          value: p.id,
        };
      }),
    );

  await interaction.reply({
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

async function doLeave(interaction: ButtonInteraction, tournamentId: string) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await upsertUser(interaction.user);

  // Captain
  const asCaptain = await prisma.participant.findFirst({
    where: { tournamentId, userId: user.id },
  });
  if (asCaptain) {
    await prisma.participant.delete({ where: { id: asCaptain.id } });
    await refreshRegistration(interaction, tournamentId);
    await interaction.editReply({
      content: `✓ Saliste del equipo **${asCaptain.teamName}** (eras capitán, equipo disuelto).`,
    });
    return;
  }

  // Teammate (estar en teammates de alguien)
  const teams = await prisma.participant.findMany({ where: { tournamentId } });
  const inTeam = teams.find((p) =>
    Array.isArray(p.teammates) ? (p.teammates as string[]).includes(user.id) : false,
  );
  if (!inTeam) {
    await interaction.editReply({ content: 'No estás en ningún equipo de este torneo.' });
    return;
  }
  const tm = (inTeam.teammates as string[]).filter((id) => id !== user.id);
  await prisma.participant.update({
    where: { id: inTeam.id },
    data: { teammates: tm },
  });
  await refreshRegistration(interaction, tournamentId);
  await interaction.editReply({
    content: `✓ Saliste del equipo **${inTeam.teamName}**.`,
  });
}

async function refreshRegistration(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
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
  await msg
    .edit({
      embeds: [tournamentRegistrationEmbed(updated, updated.participants)],
      components: [teamButtons(updated.id)],
    })
    .catch((err) => logger.warn({ err }, 'No pude editar mensaje de registro de equipos'));
}
