import type { BracketSeed, BracketMatch } from '@camibot/types';
import { generateRoundRobin } from './round-robin';
import { generateSingleElim } from './single-elim';

/**
 * Fase de grupos + playoffs.
 *
 * Convención:
 *   - Round 1..N → matches de la fase de grupos (round robin dentro de cada grupo).
 *   - Round 100+ → playoffs (single-elim con los clasificados).
 *     `round = 100 + roundDePlayoffs` (ej 101 = playoffs R1, 102 = playoffs R2).
 *
 * IDs:
 *   - `gs_g{group}_r{round}_m{matchNumber}` para fase de grupos
 *   - `po_r{playoffRound}_m{matchNumber}` para playoffs
 */
export const PLAYOFF_ROUND_OFFSET = 100;

export interface SplitGroupsResult {
  /** Map de participantId → groupNumber (1-indexed) */
  assignment: Map<string, number>;
  /** Grupos resultantes, cada uno con sus seeds */
  groups: BracketSeed[][];
}

/**
 * Distribuye participantes en N grupos usando snake-draft (serpiente):
 * grupo 1, 2, ..., N, N, ..., 2, 1, 1, 2, ...
 * Esto balancea la "fuerza" de cada grupo según seed.
 */
export function splitIntoGroups(
  seeds: BracketSeed[],
  groupCount: number,
): SplitGroupsResult {
  if (groupCount < 2) throw new Error('groupCount debe ser ≥ 2');
  if (seeds.length < groupCount * 2)
    throw new Error('Necesita al menos 2 participantes por grupo');

  const sorted = [...seeds].sort((a, b) => a.seed - b.seed);
  const groups: BracketSeed[][] = Array.from({ length: groupCount }, () => []);
  const assignment = new Map<string, number>();

  let direction = 1;
  let g = 0;
  for (const s of sorted) {
    groups[g]!.push(s);
    assignment.set(s.participantId, g + 1);
    g += direction;
    if (g === groupCount) {
      g = groupCount - 1;
      direction = -1;
    } else if (g === -1) {
      g = 0;
      direction = 1;
    }
  }

  return { assignment, groups };
}

/**
 * Genera todos los matches de la fase de grupos.
 * Cada match tiene id `gs_g{group}_r{round}_m{matchNumber}`.
 */
export function generateGroupStageMatches(groups: BracketSeed[][]): BracketMatch[] {
  const out: BracketMatch[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]!;
    if (group.length < 2) continue;
    const groupNum = gi + 1;
    const matches = generateRoundRobin({ seeds: group });
    for (const m of matches) {
      out.push({
        ...m,
        id: `gs_g${groupNum}_r${m.round}_m${m.matchNumber}`,
      });
    }
  }
  return out;
}

/**
 * Genera el bracket de playoffs con los participantes ya clasificados.
 * Recibe los participantes ordenados por su clasificación (top de cada grupo).
 *
 * Si la cantidad de clasificados no es potencia de 2, agrega byes.
 */
export function generatePlayoffMatches(
  qualifiedSeeds: BracketSeed[],
): BracketMatch[] {
  const matches = generateSingleElim({ seeds: qualifiedSeeds });
  // Re-etiquetar IDs con prefijo "po_" y round + offset
  return matches.map((m) => ({
    ...m,
    id: `po_r${m.round}_m${m.matchNumber}`,
    round: m.round + PLAYOFF_ROUND_OFFSET,
    nextMatchId: m.nextMatchId
      ? `po_r${parseInt(m.nextMatchId.match(/m_r(\d+)/)?.[1] ?? '0', 10)}_m${
          m.nextMatchId.match(/_(\d+)$/)?.[1] ?? '?'
        }`
      : null,
  }));
}

/**
 * Helper: dado el set de participantes con sus standings por grupo,
 * devuelve los clasificados al playoffs ordenados.
 */
export interface GroupStanding {
  participantId: string;
  groupNumber: number;
  positionInGroup: number; // 1..groupSize
  points: number;
  wins: number;
  losses: number;
}

export function rankPlayoffsQualifiers(
  standings: GroupStanding[],
  advancePerGroup: number,
): BracketSeed[] {
  // Para cada grupo, tomar los top advancePerGroup
  const byGroup = new Map<number, GroupStanding[]>();
  for (const s of standings) {
    if (!byGroup.has(s.groupNumber)) byGroup.set(s.groupNumber, []);
    byGroup.get(s.groupNumber)!.push(s);
  }
  const qualified: { ps: GroupStanding; seed: number }[] = [];

  // Asignación de seeds: 1° de cada grupo se distribuye primero (top seeds),
  // después 2° de cada grupo, etc.
  // Resultado: seeds globales en orden de mérito interno + grupo.
  let seedIdx = 1;
  for (let pos = 1; pos <= advancePerGroup; pos++) {
    for (const [, group] of byGroup) {
      const sorted = [...group].sort((a, b) => a.positionInGroup - b.positionInGroup);
      const candidate = sorted[pos - 1];
      if (candidate) {
        qualified.push({ ps: candidate, seed: seedIdx++ });
      }
    }
  }

  return qualified.map((q) => ({ participantId: q.ps.participantId, seed: q.seed }));
}
