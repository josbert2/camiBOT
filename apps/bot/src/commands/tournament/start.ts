import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { prisma, type Match } from '@camibot/db';
import { generateSingleElim, renderBracketText } from '@camibot/core';
import type { BracketSeed, BracketMatch } from '@camibot/types';
import { upsertGuild } from '../../lib/db-helpers.js';
import { bracketEmbed } from '../../lib/embeds.js';
import { logger } from '../../lib/logger.js';

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

  // Seed: por ahora orden de registro (el primero en registrarse es seed 1)
  const sortedParticipants = [...tournament.participants].sort(
    (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime(),
  );

  const seeds: BracketSeed[] = sortedParticipants.map((p, i) => ({
    participantId: p.id,
    seed: i + 1,
  }));

  const bracketMatches = generateSingleElim({ seeds });

  // Persistir matches en transacción.
  // IDs temporales de bracketMatches → reemplazar por IDs reales tras crear.
  const idMap = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    // Pase 1: crear todos los matches sin nextMatchId
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
    // Pase 2: setear nextMatchId
    for (const bm of bracketMatches) {
      if (!bm.nextMatchId) continue;
      await tx.match.update({
        where: { id: idMap.get(bm.id)! },
        data: { nextMatchId: idMap.get(bm.nextMatchId) },
      });
    }
    // Update seeds y persistir bracketData
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

  // Render bracket text
  const nameMap = new Map(
    sortedParticipants.map((p) => [p.id, p.user.globalName ?? p.user.username]),
  );
  const text = renderBracketText(bracketMatches, {
    getName: (id) => nameMap.get(id) ?? '?',
  });

  await interaction.editReply({
    content: `🚀  **${tournament.name}** iniciado con ${sortedParticipants.length} participantes.`,
    embeds: [bracketEmbed(tournament.name, text)],
    components: [],
  });

  logger.info(
    { tournamentId: tournament.id, participants: sortedParticipants.length },
    'Tournament started',
  );
}

function matchStatus(bm: BracketMatch): Match['status'] {
  // Si tiene los dos jugadores asignados, está READY
  if (bm.participant1Id && bm.participant2Id) return 'READY';
  // Si tiene uno solo (bye), debería avanzarse — el engine ya lo hizo, así que
  // este match queda COMPLETED implícitamente. Aún así marcamos PENDING para
  // que el visualizador muestre el bracket completo.
  return 'PENDING';
}
