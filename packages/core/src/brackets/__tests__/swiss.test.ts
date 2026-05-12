import { describe, it, expect } from 'vitest';
import {
  generateSwissRoundOne,
  generateNextSwissRound,
  computeSwissStandings,
  defaultSwissRounds,
  type SwissParticipant,
} from '../swiss';
import type { BracketSeed } from '@camibot/types';

function mkSeeds(n: number): BracketSeed[] {
  return Array.from({ length: n }, (_, i) => ({ participantId: `p${i + 1}`, seed: i + 1 }));
}

describe('defaultSwissRounds', () => {
  it('returns ceil(log2(N))', () => {
    expect(defaultSwissRounds(2)).toBe(1);
    expect(defaultSwissRounds(4)).toBe(2);
    expect(defaultSwissRounds(8)).toBe(3);
    expect(defaultSwissRounds(16)).toBe(4);
    expect(defaultSwissRounds(7)).toBe(3);
  });
});

describe('generateSwissRoundOne', () => {
  it('rechaza menos de 2 participantes', () => {
    expect(() => generateSwissRoundOne(mkSeeds(1))).toThrow();
  });

  it('4 participantes → 2 matches (1v3, 2v4)', () => {
    const matches = generateSwissRoundOne(mkSeeds(4));
    expect(matches).toHaveLength(2);
    expect(matches[0]?.participant1Id).toBe('p1');
    expect(matches[0]?.participant2Id).toBe('p3');
    expect(matches[1]?.participant1Id).toBe('p2');
    expect(matches[1]?.participant2Id).toBe('p4');
  });

  it('5 participantes (impar) → 2 matches + 1 bye', () => {
    const matches = generateSwissRoundOne(mkSeeds(5));
    expect(matches).toHaveLength(3);
    const bye = matches.find((m) => m.participant2Id === null);
    expect(bye).toBeDefined();
    expect(bye?.participant1Id).toBe('p5');
  });
});

describe('generateNextSwissRound', () => {
  it('empareja ganadores con ganadores', () => {
    const ps: SwissParticipant[] = [
      { participantId: 'p1', seed: 1, points: 3, opponents: ['p3'], hadBye: false },
      { participantId: 'p2', seed: 2, points: 3, opponents: ['p4'], hadBye: false },
      { participantId: 'p3', seed: 3, points: 0, opponents: ['p1'], hadBye: false },
      { participantId: 'p4', seed: 4, points: 0, opponents: ['p2'], hadBye: false },
    ];
    const matches = generateNextSwissRound(ps, 2);
    expect(matches).toHaveLength(2);
    // p1 (3pts) vs p2 (3pts) — top ranks juntos
    const top = matches.find(
      (m) =>
        (m.participant1Id === 'p1' && m.participant2Id === 'p2') ||
        (m.participant1Id === 'p2' && m.participant2Id === 'p1'),
    );
    expect(top).toBeDefined();
  });

  it('evita rematches cuando es posible', () => {
    const ps: SwissParticipant[] = [
      { participantId: 'p1', seed: 1, points: 3, opponents: ['p2'], hadBye: false },
      { participantId: 'p2', seed: 2, points: 3, opponents: ['p1'], hadBye: false },
      { participantId: 'p3', seed: 3, points: 0, opponents: ['p4'], hadBye: false },
      { participantId: 'p4', seed: 4, points: 0, opponents: ['p3'], hadBye: false },
    ];
    const matches = generateNextSwissRound(ps, 2);
    // p1 ya jugó con p2 → debería emparejarse con p3 o p4
    const p1Match = matches.find(
      (m) => m.participant1Id === 'p1' || m.participant2Id === 'p1',
    );
    const p1Opp = p1Match?.participant1Id === 'p1' ? p1Match.participant2Id : p1Match?.participant1Id;
    expect(['p3', 'p4']).toContain(p1Opp);
  });

  it('da bye al peor de menor puntos sin bye previo', () => {
    const ps: SwissParticipant[] = [
      { participantId: 'p1', seed: 1, points: 3, opponents: [], hadBye: false },
      { participantId: 'p2', seed: 2, points: 3, opponents: [], hadBye: false },
      { participantId: 'p3', seed: 3, points: 0, opponents: [], hadBye: false },
    ];
    const matches = generateNextSwissRound(ps, 2);
    const bye = matches.find((m) => m.participant2Id === null);
    expect(bye?.participant1Id).toBe('p3');
  });

  it('si todos tuvieron bye, igualmente asigna uno', () => {
    const ps: SwissParticipant[] = [
      { participantId: 'p1', seed: 1, points: 0, opponents: [], hadBye: true },
      { participantId: 'p2', seed: 2, points: 0, opponents: [], hadBye: true },
      { participantId: 'p3', seed: 3, points: 0, opponents: [], hadBye: true },
    ];
    const matches = generateNextSwissRound(ps, 2);
    expect(matches.some((m) => m.participant2Id === null)).toBe(true);
  });
});

describe('computeSwissStandings', () => {
  it('ordena por puntos y Buchholz', () => {
    const standings = computeSwissStandings(
      ['p1', 'p2', 'p3', 'p4'],
      [
        { participant1Id: 'p1', participant2Id: 'p2', winnerId: 'p1' },
        { participant1Id: 'p3', participant2Id: 'p4', winnerId: 'p3' },
        { participant1Id: 'p1', participant2Id: 'p3', winnerId: 'p1' },
        { participant1Id: 'p2', participant2Id: 'p4', winnerId: 'p2' },
      ],
    );
    expect(standings[0]?.participantId).toBe('p1');
    expect(standings[0]?.points).toBe(6);
  });

  it('Buchholz desempata empates de puntos', () => {
    const standings = computeSwissStandings(
      ['a', 'b', 'c', 'd'],
      [
        { participant1Id: 'a', participant2Id: 'b', winnerId: 'a' },
        { participant1Id: 'c', participant2Id: 'd', winnerId: 'c' },
        // a vs c: ambos invictos, gana a
        { participant1Id: 'a', participant2Id: 'c', winnerId: 'a' },
        // b vs d: b ya tiene 0 points y d 0 points, gana b
        { participant1Id: 'b', participant2Id: 'd', winnerId: 'b' },
      ],
    );
    expect(standings[0]?.participantId).toBe('a');
  });
});
