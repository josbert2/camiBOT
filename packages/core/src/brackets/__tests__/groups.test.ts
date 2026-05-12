import { describe, it, expect } from 'vitest';
import {
  splitIntoGroups,
  generateGroupStageMatches,
  rankPlayoffsQualifiers,
  PLAYOFF_ROUND_OFFSET,
} from '../groups';
import type { BracketSeed } from '@camibot/types';

function mkSeeds(n: number): BracketSeed[] {
  return Array.from({ length: n }, (_, i) => ({ participantId: `p${i + 1}`, seed: i + 1 }));
}

describe('splitIntoGroups', () => {
  it('rechaza menos de 2 por grupo', () => {
    expect(() => splitIntoGroups(mkSeeds(3), 2)).toThrow();
  });

  it('8 participantes en 2 grupos: snake draft', () => {
    const { groups, assignment } = splitIntoGroups(mkSeeds(8), 2);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(4);
    expect(groups[1]).toHaveLength(4);
    // Snake: p1→g1, p2→g2, p3→g2, p4→g1, p5→g1, p6→g2, p7→g2, p8→g1
    expect(assignment.get('p1')).toBe(1);
    expect(assignment.get('p2')).toBe(2);
    expect(assignment.get('p3')).toBe(2);
    expect(assignment.get('p4')).toBe(1);
  });

  it('cada grupo balanceado por suma de seeds', () => {
    const { groups } = splitIntoGroups(mkSeeds(8), 2);
    const sum = (g: BracketSeed[]) => g.reduce((s, p) => s + p.seed, 0);
    const sums = groups.map(sum);
    // Con snake en 8 participantes y 2 grupos: g1 = 1+4+5+8 = 18, g2 = 2+3+6+7 = 18
    expect(sums[0]).toBe(sums[1]);
  });
});

describe('generateGroupStageMatches', () => {
  it('genera matches RR para cada grupo', () => {
    const { groups } = splitIntoGroups(mkSeeds(8), 2);
    const matches = generateGroupStageMatches(groups);
    // 2 grupos de 4 → 6 matches por grupo → 12 total
    expect(matches).toHaveLength(12);
    expect(matches.every((m) => m.id.startsWith('gs_'))).toBe(true);
  });

  it('IDs incluyen el número de grupo', () => {
    const { groups } = splitIntoGroups(mkSeeds(8), 2);
    const matches = generateGroupStageMatches(groups);
    expect(matches.some((m) => m.id.startsWith('gs_g1_'))).toBe(true);
    expect(matches.some((m) => m.id.startsWith('gs_g2_'))).toBe(true);
  });
});

describe('rankPlayoffsQualifiers', () => {
  it('toma top N de cada grupo con seeds globales', () => {
    const standings = [
      { participantId: 'p1', groupNumber: 1, positionInGroup: 1, points: 9, wins: 3, losses: 0 },
      { participantId: 'p2', groupNumber: 1, positionInGroup: 2, points: 6, wins: 2, losses: 1 },
      { participantId: 'p3', groupNumber: 1, positionInGroup: 3, points: 3, wins: 1, losses: 2 },
      { participantId: 'p4', groupNumber: 2, positionInGroup: 1, points: 9, wins: 3, losses: 0 },
      { participantId: 'p5', groupNumber: 2, positionInGroup: 2, points: 6, wins: 2, losses: 1 },
      { participantId: 'p6', groupNumber: 2, positionInGroup: 3, points: 3, wins: 1, losses: 2 },
    ];
    const qualified = rankPlayoffsQualifiers(standings, 2);
    expect(qualified).toHaveLength(4);
    // Primero los 1° de cada grupo, después los 2°
    expect(qualified[0]?.participantId).toBe('p1');
    expect(qualified[1]?.participantId).toBe('p4');
    expect(qualified[2]?.participantId).toBe('p2');
    expect(qualified[3]?.participantId).toBe('p5');
  });
});

describe('PLAYOFF_ROUND_OFFSET', () => {
  it('es 100', () => {
    expect(PLAYOFF_ROUND_OFFSET).toBe(100);
  });
});
