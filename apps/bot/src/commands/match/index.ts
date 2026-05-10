import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import { applyMatchResult } from '@camibot/core';
import type { BracketMatch } from '@camibot/types';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild } from '../../lib/db-helpers.js';
import { logger } from '../../lib/logger.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Reportar y consultar matches')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('report')
        .setDescription('Reportar el resultado de tu match actual')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('result')
            .setDescription('Resultado')
            .setRequired(true)
            .addChoices(
              { name: 'Gané', value: 'WIN' },
              { name: 'Perdí', value: 'LOSS' },
            ),
        )
        .addIntegerOption((o) =>
          o.setName('my-score').setDescription('Tu score (opcional)').setMinValue(0),
        )
        .addIntegerOption((o) =>
          o.setName('opp-score').setDescription('Score del oponente (opcional)').setMinValue(0),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'report') return handleReport(interaction);
  },
};

async function handleReport(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  const result = interaction.options.getString('result', true) as 'WIN' | 'LOSS';
  const myScore = interaction.options.getInteger('my-score') ?? (result === 'WIN' ? 1 : 0);
  const oppScore = interaction.options.getInteger('opp-score') ?? (result === 'WIN' ? 0 : 1);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
  });
  if (!tournament || tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: 'Torneo no encontrado o no está en curso.' });
    return;
  }

  const me = await prisma.participant.findFirst({
    where: { tournamentId: tournament.id, user: { discordId: interaction.user.id } },
  });
  if (!me) {
    await interaction.editReply({ content: 'No estás participando en este torneo.' });
    return;
  }

  // Buscar match READY donde el user participa
  const myMatch = await prisma.match.findFirst({
    where: {
      tournamentId: tournament.id,
      status: 'READY',
      OR: [{ participant1Id: me.id }, { participant2Id: me.id }],
    },
  });
  if (!myMatch) {
    await interaction.editReply({ content: 'No tenés ningún match listo para reportar.' });
    return;
  }

  const meIsP1 = myMatch.participant1Id === me.id;
  const winnerId = result === 'WIN' ? me.id : meIsP1 ? myMatch.participant2Id : myMatch.participant1Id;
  if (!winnerId) {
    await interaction.editReply({ content: 'Match incompleto. Falta oponente.' });
    return;
  }

  const scoreP1 = meIsP1 ? myScore : oppScore;
  const scoreP2 = meIsP1 ? oppScore : myScore;

  // Actualizar match en DB y avanzar
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: myMatch.id },
      data: {
        scoreP1,
        scoreP2,
        winnerId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Crear MatchReport
    await tx.matchReport.create({
      data: {
        matchId: myMatch.id,
        reporterId: me.id,
        scoreP1,
        scoreP2,
        winnerId,
      },
    });

    // Si hay nextMatch, escribir winnerId en el slot vacío.
    if (myMatch.nextMatchId) {
      const next = await tx.match.findUnique({ where: { id: myMatch.nextMatchId } });
      if (next) {
        const update: Record<string, unknown> = {};
        if (!next.participant1Id) update.participant1Id = winnerId;
        else if (!next.participant2Id) update.participant2Id = winnerId;
        // Si ahora tiene los dos, marcar READY
        const willHaveBoth =
          (update.participant1Id ?? next.participant1Id) &&
          (update.participant2Id ?? next.participant2Id);
        if (willHaveBoth) update.status = 'READY';
        if (Object.keys(update).length > 0) {
          await tx.match.update({ where: { id: next.id }, data: update });
        }
      }
    } else {
      // Era la final
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
      await tx.participant.update({
        where: { id: winnerId },
        data: { status: 'WINNER', finalRank: 1 },
      });
    }

    // Wins/losses
    await tx.participant.update({
      where: { id: winnerId },
      data: { wins: { increment: 1 } },
    });
    const loserId = winnerId === myMatch.participant1Id ? myMatch.participant2Id : myMatch.participant1Id;
    if (loserId) {
      await tx.participant.update({
        where: { id: loserId },
        data: { losses: { increment: 1 }, status: 'ELIMINATED' },
      });
    }
  });

  // Re-evaluar bracketData sintético (engine puro) — solo para mantener `bracketData` consistente
  if (tournament.bracketData) {
    try {
      const data = tournament.bracketData as unknown as BracketMatch[];
      // El engine usa IDs sintéticos `m_r{round}_{n}`. No los tenemos en DB, así que esto
      // queda solo como cache desactualizada por ahora — se regenera desde DB cuando se renderiza.
      // TODO Fase 2: replicar en bracketData usando IDs reales.
      void applyMatchResult; // referencia para evitar tree-shaking del import si no se usa
      void data;
    } catch (err) {
      logger.warn({ err }, 'No pude actualizar bracketData');
    }
  }

  await interaction.editReply({
    content: `✓ Resultado registrado: ${myScore}-${oppScore}. ${
      myMatch.nextMatchId ? 'Avanzaste de ronda.' : '¡Ganaste el torneo!'
    }`,
  });

  logger.info(
    { matchId: myMatch.id, winnerId, scoreP1, scoreP2 },
    'Match reported',
  );
}

export default command;
