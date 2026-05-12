import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild } from '../../lib/db-helpers.js';
import { logger } from '../../lib/logger.js';
import { updateLeaderboardForCompletedTournament } from '../../lib/leaderboard.js';
import { announceTournamentCompletion } from '../../lib/announce.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('score')
    .setDescription('Reportar puntaje en torneos FFA / Carrera')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('submit')
        .setDescription('Subir/actualizar tu puntaje en un torneo FFA')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        )
        .addNumberOption((o) =>
          o.setName('score').setDescription('Tu puntaje numérico').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('note').setDescription('Nota opcional (ej. "1:23:45 lap")'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('[admin] Cerrar torneo FFA y declarar ganador por mejor puntaje')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'submit') return handleSubmit(interaction);
    if (sub === 'close') return handleClose(interaction);
  },
};

async function handleSubmit(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  const score = interaction.options.getNumber('score', true);
  const note = interaction.options.getString('note');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }
  if (tournament.format !== 'FFA') {
    await interaction.editReply({
      content: `Solo torneos FFA aceptan score libre. Este es ${tournament.format}.`,
    });
    return;
  }
  if (tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({
      content: `El torneo está en ${tournament.status}, no se pueden reportar scores.`,
    });
    return;
  }

  const me = await prisma.participant.findFirst({
    where: { tournamentId: tournament.id, user: { discordId: interaction.user.id } },
  });
  if (!me) {
    await interaction.editReply({ content: 'No estás participando en este torneo.' });
    return;
  }

  await prisma.participant.update({
    where: { id: me.id },
    data: { ffaScore: score, ffaNote: note ?? undefined },
  });

  const dir = tournament.ffaDirection === 'LOWER_BETTER' ? 'menor = mejor' : 'mayor = mejor';
  await interaction.editReply({
    content: `✓ Score registrado: **${score}**${note ? ` (${note})` : ''}. Modo: ${dir}.`,
  });
  logger.info(
    { tournamentId: tournament.id, participantId: me.id, score },
    'FFA score submitted',
  );
}

async function handleClose(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Gate admin
  const adminIds = (process.env.ADMIN_DISCORD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!adminIds.includes(interaction.user.id)) {
    await interaction.editReply({ content: 'Solo admins pueden cerrar el torneo.' });
    return;
  }

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
    include: { participants: true },
  });
  if (!tournament || tournament.format !== 'FFA') {
    await interaction.editReply({ content: 'Torneo FFA no encontrado.' });
    return;
  }
  if (tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: `Estado: ${tournament.status}.` });
    return;
  }

  const reported = tournament.participants.filter((p) => p.ffaScore !== null);
  if (reported.length === 0) {
    await interaction.editReply({ content: 'Nadie reportó score todavía.' });
    return;
  }

  const dirLower = tournament.ffaDirection === 'LOWER_BETTER';
  const ranked = [...reported].sort((a, b) => {
    const sa = Number(a.ffaScore);
    const sb = Number(b.ffaScore);
    return dirLower ? sa - sb : sb - sa;
  });

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ranked.length; i++) {
      await tx.participant.update({
        where: { id: ranked[i]!.id },
        data: {
          finalRank: i + 1,
          status: i === 0 ? 'WINNER' : 'ELIMINATED',
          wins: i === 0 ? 1 : 0,
        },
      });
    }
    // Marcar como WITHDRAWN a los que no reportaron
    const noShow = tournament.participants.filter((p) => p.ffaScore === null);
    for (const p of noShow) {
      await tx.participant.update({
        where: { id: p.id },
        data: { status: 'WITHDRAWN' },
      });
    }
    await tx.tournament.update({
      where: { id: tournament.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
  });

  await updateLeaderboardForCompletedTournament(tournament.id).catch(() => {});
  await announceTournamentCompletion(tournament.id);

  const winnerName = ranked[0]?.id ?? '?';
  await interaction.editReply({
    content: `✓ Torneo cerrado. Ganador: participantId ${winnerName} con ${ranked[0]?.ffaScore}.`,
  });
}

export default command;
