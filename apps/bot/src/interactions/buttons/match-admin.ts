import { MessageFlags, PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import { prisma } from '@camibot/db';
import { applyMatchResult } from '../../lib/match-result.js';
import { buildMatchPanel } from '../../lib/match-panel.js';
import { logger } from '../../lib/logger.js';

/**
 * customId:
 *   `match:admin-win:{matchId}:{p1|p2}`   → marcar ganador
 *   `match:admin-refresh:{tournamentId}` → refrescar el panel
 */
export async function handleMatchAdminButton(interaction: ButtonInteraction) {
  // Gate de permisos: ADMIN_DISCORD_IDS o ManageEvents
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
      content: 'Solo admins pueden usar este panel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action === 'admin-refresh') {
    const tournamentId = parts[2];
    if (!tournamentId) return;
    const panel = await buildMatchPanel(tournamentId);
    if (!panel) {
      await interaction.reply({ content: 'No pude refrescar.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update({ embeds: [panel.embed], components: panel.rows });
    return;
  }

  if (action === 'admin-win') {
    const matchId = parts[2];
    const side = parts[3] as 'p1' | 'p2' | undefined;
    if (!matchId || !side) return;

    await interaction.deferUpdate();

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      await interaction.followUp({
        content: 'Match no encontrado.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const winnerId = side === 'p1' ? match.participant1Id : match.participant2Id;
    if (!winnerId) {
      await interaction.followUp({
        content: 'Match incompleto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Si el admin tiene un Participant en el torneo, usamos su Participant.id como reporter.
      // Si no, usamos el winnerId (que es un participant válido) como fallback para satisfacer FK.
      const adminParticipant = await prisma.participant.findFirst({
        where: { tournamentId: match.tournamentId, user: { discordId: interaction.user.id } },
      });
      await prisma.matchReport.create({
        data: {
          matchId: match.id,
          reporterId: adminParticipant?.id ?? winnerId,
          scoreP1: winnerId === match.participant1Id ? 1 : 0,
          scoreP2: winnerId === match.participant2Id ? 1 : 0,
          winnerId,
        },
      });
      await applyMatchResult({
        tournamentId: match.tournamentId,
        matchId: match.id,
        winnerId,
      });
    } catch (err) {
      logger.warn({ err, matchId }, 'admin-win fallo');
      await interaction.followUp({
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const panel = await buildMatchPanel(match.tournamentId);
    if (panel) {
      await interaction.editReply({ embeds: [panel.embed], components: panel.rows });
    }
  }
}
