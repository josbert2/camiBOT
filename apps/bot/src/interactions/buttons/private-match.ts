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
import { prisma, Prisma } from '@camibot/db';
import { upsertUser } from '../../lib/db-helpers.js';
import { refreshPrivadaPanel } from '../../lib/private-match-panel.js';
import { logger } from '../../lib/logger.js';

function cleanGameId(v: string): string | null {
  const t = v.trim();
  return t ? t.slice(0, 64) : null;
}

/**
 * Botones de una privada:
 *   `privada:signup:{id}`      → solos: abre modal (ID de juego opcional)
 *   `privada:leave:{id}`       → salir (si sos capitán, disuelve tu equipo)
 *   `privada:team-create:{id}` → equipos: abre modal (nombre + ID de juego)
 *   `privada:team-join:{id}`   → equipos: muestra select de equipos con cupo
 */
export async function handlePrivadaButton(interaction: ButtonInteraction) {
  const [, action, matchId] = interaction.customId.split(':');
  if (!matchId) return;
  if (action === 'signup') return showSignupModal(interaction, matchId);
  if (action === 'team-create') return showCreateModal(interaction, matchId);
  if (action === 'team-join') return showJoinSelect(interaction, matchId);
  if (action === 'leave') return doLeave(interaction, matchId);
}

export async function handlePrivadaModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(':');
  const kind = parts[1];
  const matchId = parts[2];
  if (!matchId) return;
  if (kind === 'signup-submit') return submitSolo(interaction, matchId);
  if (kind === 'team-create-submit') return submitCreate(interaction, matchId);
  if (kind === 'join-submit') return submitJoin(interaction, matchId, parts[3]);
}

export async function handlePrivadaSelect(interaction: StringSelectMenuInteraction) {
  const [, , matchId] = interaction.customId.split(':');
  const squadId = interaction.values[0];
  if (!matchId || !squadId) return;
  // Pedimos el ID de juego (opcional) y luego unimos.
  const modal = new ModalBuilder()
    .setCustomId(`privada:join-submit:${matchId}:${squadId}`)
    .setTitle('Unirme al equipo')
    .addComponents(gameIdRow());
  await interaction.showModal(modal);
}

// --- Modales ---

function gameIdRow() {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId('game-id')
      .setLabel('ID de juego (opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(64),
  );
}

async function showSignupModal(interaction: ButtonInteraction, matchId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`privada:signup-submit:${matchId}`)
    .setTitle('Apuntarme')
    .addComponents(gameIdRow());
  await interaction.showModal(modal);
}

async function showCreateModal(interaction: ButtonInteraction, matchId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`privada:team-create-submit:${matchId}`)
    .setTitle('Crear equipo')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('team-name')
          .setLabel('Nombre del equipo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(40),
      ),
      gameIdRow(),
    );
  await interaction.showModal(modal);
}

async function showJoinSelect(interaction: ButtonInteraction, matchId: string) {
  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    include: { squads: { include: { _count: { select: { members: true } } } } },
  });
  if (!match) {
    await interaction.reply({ content: 'Privada no encontrada.', flags: MessageFlags.Ephemeral });
    return;
  }
  const open = match.squads.filter((sq) => sq._count.members < match.squadSize);
  if (!open.length) {
    await interaction.reply({
      content: 'No hay equipos con cupo. Creá uno con "Crear equipo".',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(`privada:team-join-select:${matchId}`)
    .setPlaceholder('Elegí equipo')
    .addOptions(
      open.slice(0, 25).map((sq) => ({
        label: `${sq.name} (${sq._count.members}/${match.squadSize})`,
        value: sq.id,
      })),
    );
  await interaction.reply({
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

// --- Lógica ---

async function submitSolo(interaction: ModalSubmitInteraction, matchId: string) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const gameId = cleanGameId(interaction.fields.getTextInputValue('game-id'));

  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    include: { _count: { select: { signups: true } } },
  });
  if (!match || !match.hasSignup) return editErr(interaction, 'Privada no disponible.');
  if (match.status !== 'OPEN') return editErr(interaction, 'La inscripción está cerrada.');

  const user = await upsertUser(interaction.user);
  const existing = await prisma.privateMatchSignup.findUnique({
    where: { matchId_userId: { matchId, userId: user.id } },
  });
  if (!existing && match.maxPlayers != null && match._count.signups >= match.maxPlayers) {
    return editErr(interaction, 'Cupo lleno.');
  }
  await prisma.privateMatchSignup.upsert({
    where: { matchId_userId: { matchId, userId: user.id } },
    update: { gameId },
    create: { matchId, userId: user.id, gameId },
  });
  await refreshPrivadaPanel(interaction.client, matchId);
  await interaction.editReply({ content: '✓ Anotado. Nos vemos en la sala.' });
  logger.info({ matchId, userId: user.id }, 'Privada signup (solo)');
}

async function submitCreate(interaction: ModalSubmitInteraction, matchId: string) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const teamName = interaction.fields.getTextInputValue('team-name').trim();
  const gameId = cleanGameId(interaction.fields.getTextInputValue('game-id'));
  if (teamName.length < 2) return editErr(interaction, 'Nombre de equipo muy corto.');

  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    include: { _count: { select: { signups: true } } },
  });
  if (!match || !match.hasSignup || match.squadSize <= 1) return editErr(interaction, 'Privada no disponible.');
  if (match.status !== 'OPEN') return editErr(interaction, 'La inscripción está cerrada.');

  const user = await upsertUser(interaction.user);
  const existing = await prisma.privateMatchSignup.findUnique({
    where: { matchId_userId: { matchId, userId: user.id } },
  });
  if (!existing && match.maxPlayers != null && match._count.signups >= match.maxPlayers) {
    return editErr(interaction, 'Cupo lleno.');
  }

  let squad;
  try {
    squad = await prisma.privateSquad.create({
      data: { matchId, name: teamName.slice(0, 40), captainId: user.id },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return editErr(interaction, 'Ya tenés un equipo en esta privada.');
    }
    throw e;
  }
  await prisma.privateMatchSignup.upsert({
    where: { matchId_userId: { matchId, userId: user.id } },
    update: { squadId: squad.id, gameId },
    create: { matchId, userId: user.id, squadId: squad.id, gameId },
  });
  await refreshPrivadaPanel(interaction.client, matchId);
  await interaction.editReply({ content: `✓ Equipo **${teamName}** creado. Sos el capitán.` });
}

async function submitJoin(interaction: ModalSubmitInteraction, matchId: string, squadId?: string) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!squadId) return editErr(interaction, 'No elegiste equipo.');
  const gameId = cleanGameId(interaction.fields.getTextInputValue('game-id'));

  const match = await prisma.privateMatch.findUnique({
    where: { id: matchId },
    include: { _count: { select: { signups: true } } },
  });
  if (!match || !match.hasSignup) return editErr(interaction, 'Privada no disponible.');
  if (match.status !== 'OPEN') return editErr(interaction, 'La inscripción está cerrada.');

  const user = await upsertUser(interaction.user);
  const myCaptain = await prisma.privateSquad.findUnique({
    where: { matchId_captainId: { matchId, captainId: user.id } },
  });
  if (myCaptain && myCaptain.id !== squadId) {
    return editErr(interaction, 'Sos capitán de otro equipo. Salí primero.');
  }

  const squad = await prisma.privateSquad.findFirst({
    where: { id: squadId, matchId },
    include: { _count: { select: { members: true } } },
  });
  if (!squad) return editErr(interaction, 'Equipo no encontrado.');

  const existing = await prisma.privateMatchSignup.findUnique({
    where: { matchId_userId: { matchId, userId: user.id } },
  });
  const alreadyInThis = existing?.squadId === squadId;
  if (!alreadyInThis && squad._count.members >= match.squadSize) {
    return editErr(interaction, 'Ese equipo está completo.');
  }
  if (!existing && match.maxPlayers != null && match._count.signups >= match.maxPlayers) {
    return editErr(interaction, 'Cupo lleno.');
  }

  await prisma.privateMatchSignup.upsert({
    where: { matchId_userId: { matchId, userId: user.id } },
    update: { squadId, gameId },
    create: { matchId, userId: user.id, squadId, gameId },
  });
  await refreshPrivadaPanel(interaction.client, matchId);
  await interaction.editReply({ content: `✓ Te uniste al equipo **${squad.name}**.` });
}

async function doLeave(interaction: ButtonInteraction, matchId: string) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await upsertUser(interaction.user);
  await prisma.privateSquad.deleteMany({ where: { matchId, captainId: user.id } });
  const { count } = await prisma.privateMatchSignup.deleteMany({ where: { matchId, userId: user.id } });
  await refreshPrivadaPanel(interaction.client, matchId);
  await interaction.editReply({ content: count ? 'Saliste de la privada.' : 'No estabas apuntado.' });
}

async function editErr(interaction: ModalSubmitInteraction, msg: string) {
  await interaction.editReply({ content: msg });
}
