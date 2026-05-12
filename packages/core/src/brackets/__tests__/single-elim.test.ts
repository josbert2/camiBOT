import { describe, it, expect } from 'vitest';
import { generateSingleElim, applyMatchResult } from '../single-elim';
import type { BracketSeed } from '@camibot/types';

function mkSeeds(n: number): BracketSeed[] {
  return Array.from({ length: n }, (_, i) => ({ participantId: `p${i + 1}`, seed: i + 1 }));
}

describe('generateSingleElim', () => {
  it('rejects < 2 participants', () => {
    expect(() => generateSingleElim({ seeds: mkSeeds(1) })).toThrow();
  });

  it('2 participantes → 1 match', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(2) });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.participant1Id).toBe('p1');
    expect(matches[0]?.participant2Id).toBe('p2');
    expect(matches[0]?.nextMatchId).toBeNull();
  });

  it('4 participantes → 3 matches (2 ronda 1, 1 final)', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(4) });
    expect(matches).toHaveLength(3);
    const r1 = matches.filter((m) => m.round === 1);
    const r2 = matches.filter((m) => m.round === 2);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(1);
    // 1v4, 2v3
    expect(r1[0]?.participant1Id).toBe('p1');
    expect(r1[0]?.participant2Id).toBe('p4');
    expect(r1[1]?.participant1Id).toBe('p2');
    expect(r1[1]?.participant2Id).toBe('p3');
    // ambos r1 enlazan a la final
    expect(r1[0]?.nextMatchId).toBe(r2[0]?.id);
    expect(r1[1]?.nextMatchId).toBe(r2[0]?.id);
  });

  it('8 participantes → 7 matches', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(8) });
    expect(matches).toHaveLength(7);
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    // Pareos: 1v8, 4v5, 2v7, 3v6
    const pairs = r1.map((m) => [m.participant1Id, m.participant2Id]);
    expect(pairs).toContainEqual(['p1', 'p8']);
    expect(pairs).toContainEqual(['p4', 'p5']);
    expect(pairs).toContainEqual(['p2', 'p7']);
    expect(pairs).toContainEqual(['p3', 'p6']);
  });

  it('byes: 5 participantes → bracket size 8 con 3 byes', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(5) });
    const r1 = matches.filter((m) => m.round === 1);
    // Round 1 tiene 4 matches; 3 son byes (un solo participante).
    const byes = r1.filter(
      (m) => (m.participant1Id && !m.participant2Id) || (!m.participant1Id && m.participant2Id),
    );
    expect(byes).toHaveLength(3);

    // Top seed avanza automático a round 2
    const r2 = matches.filter((m) => m.round === 2);
    const p1AdvancedToR2 = r2.some(
      (m) => m.participant1Id === 'p1' || m.participant2Id === 'p1',
    );
    expect(p1AdvancedToR2).toBe(true);
  });

  it('16 participantes → 15 matches, 4 rondas', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(16) });
    expect(matches).toHaveLength(15);
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds.size).toBe(4);
  });
});

describe('applyMatchResult', () => {
  it('avanza el ganador al next match', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(4) });
    const r1m1 = matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    const final = matches.find((m) => m.round === 2)!;

    const result = applyMatchResult(matches, r1m1.id, 'p1');

    expect(result.advanced).toBe(true);
    expect(result.nextMatchId).toBe(final.id);
    expect(final.participant1Id).toBe('p1');
  });

  it('lanza si el ganador no participó', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(4) });
    const r1m1 = matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    expect(() => applyMatchResult(matches, r1m1.id, 'p99')).toThrow();
  });

  it('final no avanza (no hay next)', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(2) });
    const result = applyMatchResult(matches, matches[0]!.id, 'p1');
    expect(result.advanced).toBe(false);
  });

  it('flujo completo: 4 jugadores, p1 gana todo', () => {
    const matches = generateSingleElim({ seeds: mkSeeds(4) });
    const r1 = matches.filter((m) => m.round === 1);
    applyMatchResult(matches, r1[0]!.id, 'p1'); // p1 vs p4 → p1
    applyMatchResult(matches, r1[1]!.id, 'p2'); // p2 vs p3 → p2
    const final = matches.find((m) => m.round === 2)!;
    expect(final.participant1Id).toBe('p1');
    expect(final.participant2Id).toBe('p2');
    applyMatchResult(matches, final.id, 'p1');
    // No hay next, queda como ganador implícito
  });
});
