import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertGuild } from '../../lib/db-helpers.js';
import { logger } from '../../lib/logger.js';
import { applyMatchResult } from '../../lib/match-result.js';
import { buildMatchPanel } from '../../lib/match-panel.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Reportar y consultar matches')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('[admin] Panel para marcar ganador de matches con botones')
        .addStringOption((o) =>
          o.setName('tournament').setDescription('Slug del torneo').setRequired(true),
        ),
    )
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
        .addUserOption((o) =>
          o.setName('vs').setDescription('Contra quién (si tenés varios matches abiertos)'),
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
    if (sub === 'panel') return handlePanel(interaction);
    if (sub === 'report') return handleReport(interaction);
  },
};

async function handlePanel(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const adminIds = (process.env.ADMIN_DISCORD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const member = interaction.member;
  const hasManageEvents =
    member &&
    'permissions' in member &&
    typeof member.permissions !== 'string' &&
    member.permissions.has(PermissionFlagsBits.ManageEvents);
  if (!adminIds.includes(interaction.user.id) && !hasManageEvents) {
    await interaction.reply({
      content: 'Solo admins (Manage Events o ADMIN_DISCORD_IDS).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const slug = interaction.options.getString('tournament', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
    select: { id: true, status: true },
  });
  if (!tournament || tournament.status !== 'IN_PROGRESS') {
    await interaction.editReply({ content: 'Torneo no encontrado o no está en curso.' });
    return;
  }

  const panel = await buildMatchPanel(tournament.id);
  if (!panel) {
    await interaction.editReply({ content: 'No pude armar el panel.' });
    return;
  }

  await interaction.editReply({ embeds: [panel.embed], components: panel.rows });
}

async function handleReport(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('tournament', true);
  const result = interaction.options.getString('result', true) as 'WIN' | 'LOSS';
  const myScore = interaction.options.getInteger('my-score') ?? (result === 'WIN' ? 1 : 0);
  const oppScore = interaction.options.getInteger('opp-score') ?? (result === 'WIN' ? 0 : 1);
  const opponent = interaction.options.getUser('vs');

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

  const myReadyMatches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      status: 'READY',
      OR: [{ participant1Id: me.id }, { participant2Id: me.id }],
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });
  if (myReadyMatches.length === 0) {
    await interaction.editReply({ content: 'No tenés ningún match listo para reportar.' });
    return;
  }

  let myMatch: (typeof myReadyMatches)[number] | undefined;
  if (opponent) {
    const opp = await prisma.participant.findFirst({
      where: { tournamentId: tournament.id, user: { discordId: opponent.id } },
    });
    if (!opp) {
      await interaction.editReply({
        content: `${opponent.username} no participa en este torneo.`,
      });
      return;
    }
    myMatch = myReadyMatches.find(
      (m) =>
        (m.participant1Id === me.id && m.participant2Id === opp.id) ||
        (m.participant2Id === me.id && m.participant1Id === opp.id),
    );
    if (!myMatch) {
      await interaction.editReply({
        content: `No tenés un match READY contra ${opponent.username}.`,
      });
      return;
    }
  } else if (myReadyMatches.length === 1) {
    myMatch = myReadyMatches[0]!;
  } else {
    await interaction.editReply({
      content: `Tenés ${myReadyMatches.length} matches listos. Usá la opción \`vs:\` para elegir oponente.`,
    });
    return;
  }

  const meIsP1 = myMatch.participant1Id === me.id;
  const winnerId =
    result === 'WIN'
      ? me.id
      : meIsP1
        ? myMatch.participant2Id
        : myMatch.participant1Id;
  if (!winnerId) {
    await interaction.editReply({ content: 'Match incompleto. Falta oponente.' });
    return;
  }

  const scoreP1 = meIsP1 ? myScore : oppScore;
  const scoreP2 = meIsP1 ? oppScore : myScore;

  // Doble confirmación: si el oponente ya reportó, comparamos.
  // - Si coinciden → aplicar.
  // - Si discrepan → DISPUTED, esperar al admin.
  // - Si no hay reporte previo → IN_PROGRESS, esperar al otro.
  const opponentId = meIsP1 ? myMatch.participant2Id! : myMatch.participant1Id!;
  const oppReport = await prisma.matchReport.findFirst({
    where: { matchId: myMatch.id, reporterId: opponentId },
    orderBy: { createdAt: 'desc' },
  });

  // Guardamos siempre mi reporte
  await prisma.matchReport.create({
    data: {
      matchId: myMatch.id,
      reporterId: me.id,
      scoreP1,
      scoreP2,
      winnerId,
    },
  });

  if (!oppReport) {
    // Primer reporte: queda IN_PROGRESS
    await prisma.match.update({
      where: { id: myMatch.id },
      data: { status: 'IN_PROGRESS' },
    });
    await interaction.editReply({
      content: `✓ Reporte guardado: ${myScore}-${oppScore}. Esperando a que tu oponente reporte para confirmar.`,
    });
    logger.info({ matchId: myMatch.id, first: true }, 'Match report saved (first)');
    return;
  }

  if (oppReport.winnerId !== winnerId) {
    // Discrepancia: DISPUTED
    await prisma.match.update({
      where: { id: myMatch.id },
      data: { status: 'DISPUTED' },
    });
    await interaction.editReply({
      content: `⚠️ Los reportes no coinciden. El match queda en disputa, esperá al admin.`,
    });
    logger.warn({ matchId: myMatch.id }, 'Match DISPUTED');
    return;
  }

  // Coinciden → aplicar resultado
  let outcome;
  try {
    outcome = await applyMatchResult({
      tournamentId: tournament.id,
      matchId: myMatch.id,
      winnerId,
      scoreP1,
      scoreP2,
      reporterId: me.id,
    });
  } catch (err) {
    logger.error({ err, matchId: myMatch.id }, 'Error aplicando resultado');
    await interaction.editReply({
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // VC del próximo match si pasó a READY (solo single + double elim, no round robin)
  let vcLink = '';
  if (
    outcome.nextMatchBecameReady &&
    outcome.nextMatchId &&
    tournament.voiceCategoryId &&
    interaction.guild
  ) {
    try {
      const { createMatchVoiceChannel, canManageChannels, canMoveMembers, tryMoveToVoice } =
        await import('../../lib/voice.js');
      const { getBracketContext } = await import('./vc-helpers.js');

      if (canManageChannels(interaction.guild)) {
        const ctx = await getBracketContext(outcome.nextMatchId);
        if (ctx) {
          const vc = await createMatchVoiceChannel(
            interaction.guild,
            tournament.voiceCategoryId,
            {
              matchId: outcome.nextMatchId,
              matchNumber: ctx.matchNumber,
              round: ctx.round,
              totalRounds: ctx.totalRounds,
              p1Name: ctx.p1Name,
              p2Name: ctx.p2Name,
            },
          );
          await prisma.match.update({
            where: { id: outcome.nextMatchId },
            data: { voiceChannelId: vc.id },
          });
          if (canMoveMembers(interaction.guild)) {
            await tryMoveToVoice(interaction.guild, interaction.user.id, vc.id);
          }
          vcLink = `\nPróx. match VC: <#${vc.id}>`;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'No pude crear VC del próximo match');
    }
  }

  const closing = outcome.tournamentDone
    ? `¡Torneo terminado!${outcome.extraNote}`
    : tournament.format === 'ROUND_ROBIN'
      ? 'Resultado registrado.'
      : myMatch.nextMatchId
        ? 'Avanzaste de ronda.'
        : '¡Ganaste el torneo!';

  await interaction.editReply({
    content: `✓ Resultado registrado: ${myScore}-${oppScore}. ${closing}${vcLink}`,
  });

  logger.info(
    {
      matchId: myMatch.id,
      tournamentId: tournament.id,
      format: tournament.format,
      winnerId,
      scoreP1,
      scoreP2,
      tournamentDone: outcome.tournamentDone,
    },
    'Match reported',
  );
}

export default command;
