import { type ChatInputCommandInteraction } from 'discord.js';
import { prisma, type Match, type Participant, type User, type SeedingMode } from '@camibot/db';
import { generateSingleElim, renderBracketText } from '@camibot/core';
import type { BracketSeed, BracketMatch } from '@camibot/types';
import { upsertGuild } from '../../lib/db-helpers.js';
import { bracketEmbed } from '../../lib/embeds.js';
import {
  canManageChannels,
  canMoveMembers,
  createTournamentCategory,
  createMatchVoiceChannel,
  tryMoveToVoice,
} from '../../lib/voice.js';
import { logger } from '../../lib/logger.js';

type ParticipantWithUser = Participant & { user: User };

export async function handleStart(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const slug = interaction.options.getString('name', true);
  await interaction.deferReply();

  const guild = await upsertGuild(interaction.guild);
  const tournament = await prisma.tournament.findUnique({
    where: { guildId_slug: { guildId: guild.id, slug } },
    include: {
      participants: { include: { user: true } },
    },
  });

  if (!tournament) {
    await interaction.editReply({ content: 'Torneo no encontrado.' });
    return;
  }
  if (tournament.status !== 'REGISTRATION' && tournament.status !== 'CHECK_IN') {
    await interaction.editReply({
      content: `No se puede iniciar: el torneo está en \`${tournament.status}\`.`,
    });
    return;
  }
  if (tournament.format !== 'SINGLE_ELIMINATION') {
    await interaction.editReply({ content: 'Solo single elim está soportado por ahora.' });
    return;
  }
  if (tournament.participants.length < 2) {
    await interaction.editReply({ content: 'Mínimo 2 participantes para iniciar.' });
    return;
  }

  // Ordenar según seedingMode (RANDOM por default)
  const ordered = orderParticipants(tournament.participants, tournament.seedingMode);

  const seeds: BracketSeed[] = ordered.map((p, i) => ({
    participantId: p.id,
    seed: i + 1,
  }));

  const bracketMatches = generateSingleElim({ seeds });
  const totalRounds = Math.max(...bracketMatches.map((m) => m.round));

  // Persistir matches en transacción
  const idMap = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const bm of bracketMatches) {
      const created = await tx.match.create({
        data: {
          tournamentId: tournament.id,
          round: bm.round,
          matchNumber: bm.matchNumber,
          bracketSide: bm.bracketSide,
          participant1Id: bm.participant1Id,
          participant2Id: bm.participant2Id,
          status: matchStatus(bm),
        },
      });
      idMap.set(bm.id, created.id);
    }
    for (const bm of bracketMatches) {
      if (!bm.nextMatchId) continue;
      await tx.match.update({
        where: { id: idMap.get(bm.id)! },
        data: { nextMatchId: idMap.get(bm.nextMatchId) },
      });
    }
    for (const seed of seeds) {
      await tx.participant.update({
        where: { id: seed.participantId },
        data: { seed: seed.seed },
      });
    }
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        status: 'IN_PROGRESS',
        startsAt: new Date(),
        bracketData: bracketMatches as unknown as object,
      },
    });
  });

  // Crear categoría + VCs para todos los matches READY de round 1
  const nameMap = new Map(ordered.map((p) => [p.id, p.user.globalName ?? p.user.username]));

  let vcSummary = '';
  if (canManageChannels(interaction.guild)) {
    try {
      const category = await createTournamentCategory(interaction.guild, tournament.name);
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { voiceCategoryId: category.id },
      });

      const readyMatches = bracketMatches.filter(
        (m) => m.participant1Id && m.participant2Id,
      );

      // Map participantId → discordId para auto-move
      const discordIdMap = new Map(ordered.map((p) => [p.id, p.user.discordId]));
      const canMove = canMoveMembers(interaction.guild);

      const vcLines: string[] = [];
      for (const bm of readyMatches) {
        const vc = await createMatchVoiceChannel(interaction.guild, category.id, {
          matchId: idMap.get(bm.id)!,
          matchNumber: bm.matchNumber,
          round: bm.round,
          totalRounds,
          p1Name: nameMap.get(bm.participant1Id!) ?? '?',
          p2Name: nameMap.get(bm.participant2Id!) ?? '?',
        });
        await prisma.match.update({
          where: { id: idMap.get(bm.id)! },
          data: { voiceChannelId: vc.id },
        });

        // Auto-move + mentions
        const p1DiscordId = discordIdMap.get(bm.participant1Id!) ?? '';
        const p2DiscordId = discordIdMap.get(bm.participant2Id!) ?? '';
        const mentions: string[] = [];
        if (!p1DiscordId.startsWith('dev_')) mentions.push(`<@${p1DiscordId}>`);
        if (!p2DiscordId.startsWith('dev_')) mentions.push(`<@${p2DiscordId}>`);

        if (canMove) {
          await Promise.allSettled([
            tryMoveToVoice(interaction.guild, p1DiscordId, vc.id),
            tryMoveToVoice(interaction.guild, p2DiscordId, vc.id),
          ]);
        }

        vcLines.push(`• <#${vc.id}> ${mentions.join(' vs ')}`);
      }

      const moveNote = canMove
        ? '\n_Si ya estabas en voice, te moví automáticamente al VC de tu match._'
        : '\n_No tengo permiso "Mover miembros" — entrá manualmente al VC._';
      vcSummary = `\n\n**Canales de voz** (${vcLines.length} matches de ronda 1):\n${vcLines.join('\n')}${moveNote}`;
    } catch (err) {
      logger.error({ err }, 'Fallo creando categoría/VCs');
      vcSummary = '\n\n_Error creando canales de voz — revisar logs y permisos._';
    }
  } else {
    vcSummary = '\n\n_Falta permiso "Gestionar canales" para crear los VCs automáticamente._';
  }

  // Render bracket text
  const text = renderBracketText(bracketMatches, {
    getName: (id) => nameMap.get(id) ?? '?',
  });

  const seedingLabel = tournament.seedingMode === 'RANDOM' ? 'aleatorio' : 'por registro';
  const webUrl = process.env.AUTH_URL ?? 'http://localhost:3001';
  const bracketLink = `\n\n🔗 Ver bracket completo: ${webUrl}/t/${tournament.id}`;

  await interaction.editReply({
    content: `🚀  **${tournament.name}** iniciado con ${ordered.length} participantes (seeding: ${seedingLabel}).${vcSummary}${bracketLink}`,
    embeds: [bracketEmbed(tournament.name, text)],
    components: [],
  });

  logger.info(
    {
      tournamentId: tournament.id,
      participants: ordered.length,
      seedingMode: tournament.seedingMode,
    },
    'Tournament started',
  );
}

function matchStatus(bm: BracketMatch): Match['status'] {
  if (bm.participant1Id && bm.participant2Id) return 'READY';
  return 'PENDING';
}

function orderParticipants(
  participants: ParticipantWithUser[],
  mode: SeedingMode,
): ParticipantWithUser[] {
  const byRegistration = [...participants].sort(
    (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime(),
  );
  if (mode === 'RANDOM') return shuffle(byRegistration);
  return byRegistration; // REGISTRATION o MANUAL (fallback)
}

/** Fisher-Yates shuffle in-place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
