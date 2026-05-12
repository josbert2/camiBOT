// Lógica core de aplicar un resultado a un match + avanzar el bracket según formato.
// Compartido entre /match report (user real) y /dev simulate (admin).

import { prisma, type Match, type TournamentFormat } from '@camibot/db';
import {
  computeStandings,
  computeSwissStandings,
  defaultSwissRounds,
  generateNextSwissRound,
  rankPlayoffsQualifiers,
  generatePlayoffMatches,
  PLAYOFF_ROUND_OFFSET,
  type GroupStanding,
} from '@camibot/core';
import { logger } from './logger.js';
import { updateLeaderboardForCompletedTournament } from './leaderboard.js';
import { announceTournamentCompletion } from './announce.js';
import { notifyMatchReady } from './dm-notify.js';
import { announceStreakIfMilestone } from './streak-announce.js';

export interface ApplyMatchResultInput {
  tournamentId: string;
  matchId: string;
  winnerId: string;
  scoreP1?: number;
  scoreP2?: number;
  /** Participant.id del que reporta. Si es null (caso /dev), usamos el winner como reporter. */
  reporterId?: string | null;
}

export interface ApplyMatchResultOutput {
  nextMatchId: string | null;
  nextMatchBecameReady: boolean;
  tournamentDone: boolean;
  loserId: string | null;
  extraNote: string;
}

export async function applyMatchResult(
  input: ApplyMatchResultInput,
): Promise<ApplyMatchResultOutput> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
  });
  if (!tournament) throw new Error(`Tournament ${input.tournamentId} no encontrado`);
  if (tournament.status !== 'IN_PROGRESS') {
    throw new Error(`Tournament no está en curso (estado: ${tournament.status})`);
  }

  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match) throw new Error(`Match ${input.matchId} no encontrado`);
  if (match.status === 'COMPLETED') {
    throw new Error('Match ya está completado');
  }
  if (!match.participant1Id || !match.participant2Id) {
    throw new Error('Match incompleto. Falta oponente.');
  }
  if (input.winnerId !== match.participant1Id && input.winnerId !== match.participant2Id) {
    throw new Error('Winner no pertenece a este match.');
  }

  const loserId =
    input.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
  const meIsP1 = input.winnerId === match.participant1Id;
  const scoreP1 = input.scoreP1 ?? (meIsP1 ? 1 : 0);
  const scoreP2 = input.scoreP2 ?? (meIsP1 ? 0 : 1);
  const reporterId = input.reporterId ?? input.winnerId;

  const fmt = tournament.format as TournamentFormat;
  let result: ApplyMatchResultOutput = {
    nextMatchId: null,
    nextMatchBecameReady: false,
    tournamentDone: false,
    loserId,
    extraNote: '',
  };

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        scoreP1,
        scoreP2,
        winnerId: input.winnerId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // El MatchReport lo crea el caller (puede ser admin, user, simulador, etc).
    // applyMatchResult queda enfocado en aplicar el resultado y avanzar el bracket.

    // W/L siempre
    await tx.participant.update({
      where: { id: input.winnerId },
      data: { wins: { increment: 1 } },
    });
    if (loserId) {
      await tx.participant.update({
        where: { id: loserId },
        data: { losses: { increment: 1 } },
      });
    }

    if (fmt === 'SINGLE_ELIMINATION') {
      if (loserId) {
        await tx.participant.update({
          where: { id: loserId },
          data: { status: 'ELIMINATED' },
        });
      }
      const r = await advanceWinnerToNext(tx, match, input.winnerId);
      result.nextMatchBecameReady = r.becameReady;
      result.nextMatchId = r.nextMatchId;
      if (!match.nextMatchId) {
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
        await tx.participant.update({
          where: { id: input.winnerId },
          data: { status: 'WINNER', finalRank: 1 },
        });
        result.tournamentDone = true;
      }
    } else if (fmt === 'DOUBLE_ELIMINATION') {
      const r = await advanceWinnerToNext(tx, match, input.winnerId);
      result.nextMatchBecameReady = r.becameReady;
      result.nextMatchId = r.nextMatchId;

      if (match.loserNextMatchId && loserId) {
        const ld = await tx.match.findUnique({ where: { id: match.loserNextMatchId } });
        if (ld) {
          const update: Record<string, unknown> = {};
          if (!ld.participant1Id) update.participant1Id = loserId;
          else if (!ld.participant2Id) update.participant2Id = loserId;
          const willHaveBoth =
            (update.participant1Id ?? ld.participant1Id) &&
            (update.participant2Id ?? ld.participant2Id);
          if (willHaveBoth) update.status = 'READY';
          if (Object.keys(update).length > 0) {
            await tx.match.update({ where: { id: ld.id }, data: update });
          }
        }
      } else if (loserId) {
        await tx.participant.update({
          where: { id: loserId },
          data: { status: 'ELIMINATED' },
        });
      }

      const isGrandFinal = match.bracketSide === 'GRAND_FINAL';
      const noMoreMatches = !match.nextMatchId;
      if (isGrandFinal && noMoreMatches) {
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
        await tx.participant.update({
          where: { id: input.winnerId },
          data: { status: 'WINNER', finalRank: 1 },
        });
        if (loserId) {
          await tx.participant.update({
            where: { id: loserId },
            data: { finalRank: 2 },
          });
        }
        result.tournamentDone = true;
      }
    } else if (fmt === 'SWISS') {
      // En Suizo no se elimina. Verificamos si terminó la ronda actual.
      const currentRound = match.round;
      const roundIncomplete = await tx.match.count({
        where: {
          tournamentId: tournament.id,
          round: currentRound,
          status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
        },
      });
      if (roundIncomplete === 0) {
        // Ronda terminada. ¿Cuántas en total?
        const participants = await tx.participant.findMany({
          where: { tournamentId: tournament.id },
        });
        const maxRounds = defaultSwissRounds(participants.length);

        if (currentRound >= maxRounds) {
          // Fin del torneo — calcular standings finales
          const allMatches = await tx.match.findMany({
            where: { tournamentId: tournament.id, status: 'COMPLETED' },
            select: { participant1Id: true, participant2Id: true, winnerId: true },
          });
          const standings = computeSwissStandings(
            participants.map((p) => p.id),
            allMatches
              .filter((m) => m.participant1Id && m.participant2Id && m.winnerId)
              .map((m) => ({
                participant1Id: m.participant1Id!,
                participant2Id: m.participant2Id!,
                winnerId: m.winnerId!,
              })),
          );
          for (let i = 0; i < standings.length; i++) {
            await tx.participant.update({
              where: { id: standings[i]!.participantId },
              data: {
                finalRank: i + 1,
                status: i === 0 ? 'WINNER' : 'ELIMINATED',
              },
            });
          }
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { status: 'COMPLETED', endedAt: new Date() },
          });
          result.tournamentDone = true;
          const champion = standings[0];
          if (champion) result.extraNote = ` Campeón con ${champion.points} pts (Buchholz ${champion.buchholz}).`;
        } else {
          // Generar siguiente ronda
          const completedMatches = await tx.match.findMany({
            where: { tournamentId: tournament.id, status: 'COMPLETED' },
            select: { participant1Id: true, participant2Id: true, winnerId: true, round: true },
          });

          // Calcular puntos y opponents por participant
          const pointsMap = new Map<string, number>();
          const opponentsMap = new Map<string, string[]>();
          const byeMap = new Map<string, boolean>();
          for (const p of participants) {
            pointsMap.set(p.id, 0);
            opponentsMap.set(p.id, []);
            byeMap.set(p.id, false);
          }
          for (const cm of completedMatches) {
            if (!cm.winnerId) continue;
            pointsMap.set(cm.winnerId, (pointsMap.get(cm.winnerId) ?? 0) + 3);
            if (cm.participant1Id && cm.participant2Id) {
              opponentsMap.get(cm.participant1Id)!.push(cm.participant2Id);
              opponentsMap.get(cm.participant2Id)!.push(cm.participant1Id);
            } else if (cm.participant1Id && !cm.participant2Id) {
              byeMap.set(cm.participant1Id, true);
            }
          }

          const swissParticipants = participants.map((p) => ({
            participantId: p.id,
            seed: p.seed ?? 0,
            points: pointsMap.get(p.id) ?? 0,
            opponents: opponentsMap.get(p.id) ?? [],
            hadBye: byeMap.get(p.id) ?? false,
          }));

          const nextRoundNum = currentRound + 1;
          const nextMatches = generateNextSwissRound(swissParticipants, nextRoundNum);

          for (const nm of nextMatches) {
            const isBye =
              (nm.participant1Id && !nm.participant2Id) ||
              (!nm.participant1Id && nm.participant2Id);
            const byeWinner = isBye ? (nm.participant1Id ?? nm.participant2Id) : null;
            await tx.match.create({
              data: {
                tournamentId: tournament.id,
                round: nm.round,
                matchNumber: nm.matchNumber,
                bracketSide: nm.bracketSide,
                participant1Id: nm.participant1Id,
                participant2Id: nm.participant2Id,
                status: isBye
                  ? 'COMPLETED'
                  : nm.participant1Id && nm.participant2Id
                    ? 'READY'
                    : 'PENDING',
                ...(isBye && byeWinner
                  ? { winnerId: byeWinner, scoreP1: 1, scoreP2: 0, completedAt: new Date() }
                  : {}),
              },
            });
            if (isBye && byeWinner) {
              await tx.participant.update({
                where: { id: byeWinner },
                data: { wins: { increment: 1 } },
              });
            }
          }
          result.extraNote = ` Ronda ${nextRoundNum}/${maxRounds} iniciada.`;
        }
      }
    } else if (fmt === 'GROUP_STAGE') {
      // Detectar si estamos en group phase (round < OFFSET) o playoffs (round >= OFFSET)
      const isPlayoff = match.round >= PLAYOFF_ROUND_OFFSET;

      if (isPlayoff) {
        // Comportamiento single-elim para playoffs
        if (loserId) {
          await tx.participant.update({
            where: { id: loserId },
            data: { status: 'ELIMINATED' },
          });
        }
        const r = await advanceWinnerToNext(tx, match, input.winnerId);
        result.nextMatchBecameReady = r.becameReady;
        result.nextMatchId = r.nextMatchId;
        if (!match.nextMatchId) {
          // Final de playoffs = final del torneo
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { status: 'COMPLETED', endedAt: new Date() },
          });
          await tx.participant.update({
            where: { id: input.winnerId },
            data: { status: 'WINNER', finalRank: 1 },
          });
          result.tournamentDone = true;
        }
      } else {
        // Group phase: verificar si terminó TODA la fase de grupos
        const remainingGroup = await tx.match.count({
          where: {
            tournamentId: tournament.id,
            round: { lt: PLAYOFF_ROUND_OFFSET },
            status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
          },
        });
        if (remainingGroup === 0) {
          // Calcular standings por grupo
          const participants = await tx.participant.findMany({
            where: { tournamentId: tournament.id },
            select: {
              id: true,
              groupNumber: true,
            },
          });
          const groupMatches = await tx.match.findMany({
            where: {
              tournamentId: tournament.id,
              round: { lt: PLAYOFF_ROUND_OFFSET },
              status: 'COMPLETED',
            },
            select: { participant1Id: true, participant2Id: true, winnerId: true },
          });

          // Por grupo, calcular standings
          const groupedStandings: GroupStanding[] = [];
          const byGroup = new Map<number, string[]>();
          for (const p of participants) {
            if (!p.groupNumber) continue;
            if (!byGroup.has(p.groupNumber)) byGroup.set(p.groupNumber, []);
            byGroup.get(p.groupNumber)!.push(p.id);
          }
          for (const [gNum, pIds] of byGroup) {
            const matchesOfGroup = groupMatches.filter(
              (m) =>
                pIds.includes(m.participant1Id ?? '') &&
                pIds.includes(m.participant2Id ?? ''),
            );
            const s = computeStandings(
              pIds,
              matchesOfGroup
                .filter((m) => m.winnerId && m.participant1Id && m.participant2Id)
                .map((m) => ({
                  participant1Id: m.participant1Id!,
                  participant2Id: m.participant2Id!,
                  winnerId: m.winnerId!,
                })),
            );
            for (let i = 0; i < s.length; i++) {
              groupedStandings.push({
                participantId: s[i]!.participantId,
                groupNumber: gNum,
                positionInGroup: i + 1,
                points: s[i]!.points,
                wins: s[i]!.wins,
                losses: s[i]!.losses,
              });
            }
          }

          const advance = tournament.advancePerGroup ?? 2;
          const qualified = rankPlayoffsQualifiers(groupedStandings, advance);
          if (qualified.length < 2) {
            // No alcanza para playoffs — terminamos
            await tx.tournament.update({
              where: { id: tournament.id },
              data: { status: 'COMPLETED', endedAt: new Date() },
            });
            result.tournamentDone = true;
          } else {
            // Generar playoffs y persistirlos
            const playoffMatches = generatePlayoffMatches(qualified);
            const idMap = new Map<string, string>();
            for (const pm of playoffMatches) {
              const isBye =
                (pm.participant1Id && !pm.participant2Id) ||
                (!pm.participant1Id && pm.participant2Id);
              const byeW = isBye ? (pm.participant1Id ?? pm.participant2Id) : null;
              const created = await tx.match.create({
                data: {
                  tournamentId: tournament.id,
                  round: pm.round,
                  matchNumber: pm.matchNumber,
                  bracketSide: pm.bracketSide,
                  participant1Id: pm.participant1Id,
                  participant2Id: pm.participant2Id,
                  status: isBye
                    ? 'COMPLETED'
                    : pm.participant1Id && pm.participant2Id
                      ? 'READY'
                      : 'PENDING',
                  ...(isBye && byeW
                    ? { winnerId: byeW, scoreP1: 1, scoreP2: 0, completedAt: new Date() }
                    : {}),
                },
              });
              idMap.set(pm.id, created.id);
            }
            // Re-link nextMatchId (mapeo de id string → CUID real)
            for (const pm of playoffMatches) {
              if (!pm.nextMatchId) continue;
              const realId = idMap.get(pm.id);
              const realNext = idMap.get(pm.nextMatchId);
              if (realId && realNext) {
                await tx.match.update({
                  where: { id: realId },
                  data: { nextMatchId: realNext },
                });
              }
            }
            // Eliminar a los que NO clasificaron
            const qualifiedSet = new Set(qualified.map((q) => q.participantId));
            for (const p of participants) {
              if (!qualifiedSet.has(p.id)) {
                await tx.participant.update({
                  where: { id: p.id },
                  data: { status: 'ELIMINATED' },
                });
              }
            }
            result.extraNote = ` Playoffs iniciados con ${qualified.length} clasificados.`;
          }
        }
      }
    } else if (fmt === 'ROUND_ROBIN') {
      const remaining = await tx.match.count({
        where: {
          tournamentId: tournament.id,
          status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
        },
      });
      if (remaining === 0) {
        const allMatches = await tx.match.findMany({
          where: { tournamentId: tournament.id, status: 'COMPLETED' },
          select: { participant1Id: true, participant2Id: true, winnerId: true },
        });
        const allParticipants = await tx.participant.findMany({
          where: { tournamentId: tournament.id },
          select: { id: true },
        });
        const standings = computeStandings(
          allParticipants.map((p) => p.id),
          allMatches
            .filter((m) => m.participant1Id && m.participant2Id && m.winnerId)
            .map((m) => ({
              participant1Id: m.participant1Id!,
              participant2Id: m.participant2Id!,
              winnerId: m.winnerId!,
            })),
        );
        for (let i = 0; i < standings.length; i++) {
          await tx.participant.update({
            where: { id: standings[i]!.participantId },
            data: {
              finalRank: i + 1,
              status: i === 0 ? 'WINNER' : 'ELIMINATED',
            },
          });
        }
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
        result.tournamentDone = true;
        const champion = standings[0];
        if (champion) result.extraNote = ` Campeón con ${champion.points} pts.`;
      }
    }
  });

  // Fuera de la tx: DM a participantes si avanzó a un match READY
  if (result.nextMatchBecameReady && result.nextMatchId) {
    await notifyMatchReady(result.nextMatchId);
  }

  // Anuncio de racha milestone (cross-torneos)
  await announceStreakIfMilestone(input.winnerId).catch(() => {});

  // Fuera de la tx: leaderboard + anuncio cuando se completa el torneo
  if (result.tournamentDone) {
    await updateLeaderboardForCompletedTournament(tournament.id).catch((err) =>
      logger.warn({ err, tournamentId: tournament.id }, 'leaderboard update fallo'),
    );
    await announceTournamentCompletion(tournament.id);
  }

  return result;
}

async function advanceWinnerToNext(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  match: Match,
  winnerId: string,
): Promise<{ nextMatchId: string | null; becameReady: boolean }> {
  if (!match.nextMatchId) return { nextMatchId: null, becameReady: false };
  const next = await tx.match.findUnique({ where: { id: match.nextMatchId } });
  if (!next) return { nextMatchId: match.nextMatchId, becameReady: false };

  const update: Record<string, unknown> = {};
  if (!next.participant1Id) update.participant1Id = winnerId;
  else if (!next.participant2Id) update.participant2Id = winnerId;

  const willHaveBoth =
    (update.participant1Id ?? next.participant1Id) &&
    (update.participant2Id ?? next.participant2Id);

  let becameReady = false;
  if (willHaveBoth) {
    update.status = 'READY';
    becameReady = true;
  }
  if (Object.keys(update).length > 0) {
    await tx.match.update({ where: { id: next.id }, data: update });
  }
  return { nextMatchId: next.id, becameReady };
}
