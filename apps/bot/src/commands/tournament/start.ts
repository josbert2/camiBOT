import { type ChatInputCommandInteraction } from 'discord.js';
import {
  prisma,
  type Match,
  type Participant,
  type User,
  type SeedingMode,
  type TournamentFormat,
} from '@camibot/db';
import {
  generateSingleElim,
  generateRoundRobin,
  generateDoubleElim,
  generateSwissRoundOne,
  renderBracketText,
} from '@camibot/core';
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
import { notifyMatchReady } from '../../lib/dm-notify.js';

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
  if (tournament.participants.length < 2) {
    await interaction.editReply({ content: 'Mínimo 2 participantes para iniciar.' });
    return;
  }

  // Validación de teams: todos los equipos completos
  if ((tournament.teamSize ?? 1) > 1) {
    const incomplete = tournament.participants.filter((p) => {
      const tm = Array.isArray(p.teammates) ? (p.teammates as string[]) : [];
      return 1 + tm.length < tournament.teamSize;
    });
    if (incomplete.length > 0) {
      const names = incomplete.map((p) => p.teamName ?? '?').join(', ');
      await interaction.editReply({
        content: `No puedo iniciar: estos equipos están incompletos (${tournament.teamSize}v${tournament.teamSize}): ${names}`,
      });
      return;
    }
  }

  // Validación específica para double elim: necesita potencia de 2
  if (tournament.format === 'DOUBLE_ELIMINATION') {
    const n = tournament.participants.length;
    if ((n & (n - 1)) !== 0) {
      await interaction.editReply({
        content: `Doble eliminación necesita una cantidad de participantes potencia de 2 (2, 4, 8, 16, 32, 64, 128). Tenés ${n}.`,
      });
      return;
    }
  }

  const ordered = orderParticipants(tournament.participants, tournament.seedingMode);

  const seeds: BracketSeed[] = ordered.map((p, i) => ({
    participantId: p.id,
    seed: i + 1,
  }));

  // Selección del engine según formato
  const bracketMatches = generateBracket(tournament.format, seeds);
  const totalRounds = bracketMatches.length
    ? Math.max(...bracketMatches.map((m) => m.round))
    : 1;

  // Persistir matches en transacción
  const idMap = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const bm of bracketMatches) {
      // En Suizo (y formats con BYE): si solo hay 1 participante, gana automático
      const isBye =
        (bm.participant1Id && !bm.participant2Id) ||
        (!bm.participant1Id && bm.participant2Id);
      const winnerId = isBye ? (bm.participant1Id ?? bm.participant2Id) : null;

      const created = await tx.match.create({
        data: {
          tournamentId: tournament.id,
          round: bm.round,
          matchNumber: bm.matchNumber,
          bracketSide: bm.bracketSide,
          participant1Id: bm.participant1Id,
          participant2Id: bm.participant2Id,
          status: isBye ? 'COMPLETED' : matchStatus(bm),
          ...(isBye && winnerId
            ? { winnerId, scoreP1: 1, scoreP2: 0, completedAt: new Date() }
            : {}),
        },
      });
      idMap.set(bm.id, created.id);

      // Sumar win al ganador del bye
      if (isBye && winnerId) {
        await tx.participant.update({
          where: { id: winnerId },
          data: { wins: { increment: 1 } },
        });
      }
    }
    // Re-mapear nextMatchId y loserNextMatchId a los CUIDs reales
    for (const bm of bracketMatches) {
      const realId = idMap.get(bm.id)!;
      const nextReal = bm.nextMatchId ? idMap.get(bm.nextMatchId) : null;
      const loserReal = bm.loserNextMatchId ? idMap.get(bm.loserNextMatchId) : null;
      if (nextReal || loserReal) {
        await tx.match.update({
          where: { id: realId },
          data: {
            nextMatchId: nextReal ?? null,
            loserNextMatchId: loserReal ?? null,
          },
        });
      }
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

  // DM a los participantes de matches READY de R1
  const readyR1Ids = bracketMatches
    .filter((m) => m.participant1Id && m.participant2Id)
    .map((m) => idMap.get(m.id)!)
    .filter(Boolean);
  for (const realId of readyR1Ids) {
    await notifyMatchReady(realId).catch(() => {});
  }

  // Crear categoría + VCs para todos los matches READY de ronda 1
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

      const lobbyId = process.env.LOBBY_VOICE_CHANNEL_ID;
      const lobbyNote = lobbyId
        ? `\n💡 **Entren al lobby <#${lobbyId}> antes** y los muevo automáticamente al VC de su match.`
        : '';
      const moveNote = canMove
        ? '\n_Si ya estabas en voice, te moví automáticamente al VC de tu match._'
        : '\n_No tengo permiso "Mover miembros" — entrá manualmente al VC._';
      vcSummary = `\n\n**Canales de voz** (${vcLines.length} matches con jugadores listos):\n${vcLines.join('\n')}${lobbyNote}${moveNote}`;
    } catch (err) {
      logger.error({ err }, 'Fallo creando categoría/VCs');
      vcSummary = '\n\n_Error creando canales de voz — revisar logs y permisos._';
    }
  } else {
    vcSummary = '\n\n_Falta permiso "Gestionar canales" para crear los VCs automáticamente._';
  }

  // Render texto: para round-robin/double-elim mostramos resumen, no bracket tree.
  const text = renderBracketText(bracketMatches, {
    getName: (id) => nameMap.get(id) ?? '?',
  });

  const seedingLabel = tournament.seedingMode === 'RANDOM' ? 'aleatorio' : 'por registro';
  const formatLabel = formatToLabel(tournament.format);
  const webUrl = process.env.AUTH_URL ?? 'http://localhost:3001';
  const bracketLink = `\n\n🔗 Ver bracket completo: ${webUrl}/t/${tournament.id}`;

  await interaction.editReply({
    content: `🚀  **${tournament.name}** iniciado · ${formatLabel} · ${ordered.length} participantes · seeding ${seedingLabel}.${vcSummary}${bracketLink}`,
    embeds: [bracketEmbed(tournament.name, text)],
    components: [],
  });

  logger.info(
    {
      tournamentId: tournament.id,
      format: tournament.format,
      participants: ordered.length,
      seedingMode: tournament.seedingMode,
    },
    'Tournament started',
  );
}

function generateBracket(format: TournamentFormat, seeds: BracketSeed[]): BracketMatch[] {
  switch (format) {
    case 'SINGLE_ELIMINATION':
      return generateSingleElim({ seeds });
    case 'DOUBLE_ELIMINATION':
      return generateDoubleElim({ seeds });
    case 'ROUND_ROBIN':
      return generateRoundRobin({ seeds });
    case 'SWISS':
      return generateSwissRoundOne(seeds);
    case 'FFA':
      // FFA no genera matches — cada participante reporta su score con /score submit
      return [];
    case 'GROUP_STAGE':
      // Stub: a implementar en commit aparte. Por ahora generamos RR como fallback.
      return generateRoundRobin({ seeds });
    default: {
      const _exhaustive: never = format;
      throw new Error(`Formato desconocido: ${_exhaustive as string}`);
    }
  }
}

function formatToLabel(format: TournamentFormat): string {
  switch (format) {
    case 'SINGLE_ELIMINATION':
      return 'eliminación simple';
    case 'DOUBLE_ELIMINATION':
      return 'doble eliminación';
    case 'ROUND_ROBIN':
      return 'round robin';
    case 'SWISS':
      return 'sistema suizo';
    case 'FFA':
      return 'FFA / score libre';
    case 'GROUP_STAGE':
      return 'fase de grupos';
  }
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
  return byRegistration;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
