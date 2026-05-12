import { describe, it, expect } from 'vitest';
import { generateDoubleElim, applyDoubleElimResult } from '../double-elim';
import type { BracketSeed } from '@camibot/types';

function mkSeeds(n: number): BracketSeed[] {
  return Array.from({ length: n }, (_, i) => ({ participantId: `p${i + 1}`, seed: i + 1 }));
}

describe('generateDoubleElim', () => {
  it('rechaza menos de 2 participantes', () => {
    expect(() => generateDoubleElim({ seeds: mkSeeds(1) })).toThrow();
  });

  it('rechaza N no potencia de 2', () => {
    expect(() => generateDoubleElim({ seeds: mkSeeds(3) })).toThrow();
    expect(() => generateDoubleElim({ seeds: mkSeeds(6) })).toThrow();
  });

  it('4 participantes: 3 W + 2 L + GF + Reset = 7 matches', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    expect(m).toHaveLength(7);
    expect(m.filter((x) => x.bracketSide === 'WINNERS')).toHaveLength(3);
    expect(m.filter((x) => x.bracketSide === 'LOSERS')).toHaveLength(2);
    expect(m.filter((x) => x.bracketSide === 'GRAND_FINAL')).toHaveLength(2);
  });

  it('8 participantes: 7 W + 6 L + GF + Reset = 15 matches', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(8) });
    expect(m).toHaveLength(15);
    expect(m.filter((x) => x.bracketSide === 'WINNERS')).toHaveLength(7);
    expect(m.filter((x) => x.bracketSide === 'LOSERS')).toHaveLength(6);
  });

  it('sin reset: 1 GF solo', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4), grandFinalReset: false });
    expect(m.filter((x) => x.bracketSide === 'GRAND_FINAL')).toHaveLength(1);
  });

  it('cada match de W_R1 tiene loserNextMatchId apuntando a L_R1', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const wR1 = m.filter((x) => x.bracketSide === 'WINNERS' && x.round === 1);
    for (const w of wR1) {
      expect(w.loserNextMatchId).toMatch(/^de_l_r1/);
    }
  });

  it('WB final apunta a GF, LB final apunta a GF', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const wF = m.find((x) => x.bracketSide === 'WINNERS' && x.round === 2)!;
    const lF = m.filter((x) => x.bracketSide === 'LOSERS').slice(-1)[0]!;
    expect(wF.nextMatchId).toBe('de_gf');
    expect(lF.nextMatchId).toBe('de_gf');
  });

  it('R1 popula los participantes según seeding NCAA-style', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const r1 = m.filter((x) => x.bracketSide === 'WINNERS' && x.round === 1);
    expect(r1[0]?.participant1Id).toBe('p1');
    expect(r1[0]?.participant2Id).toBe('p4');
    expect(r1[1]?.participant1Id).toBe('p2');
    expect(r1[1]?.participant2Id).toBe('p3');
  });
});

describe('applyDoubleElimResult', () => {
  it('avanza ganador y baja perdedor en W_R1', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const w1 = m.find((x) => x.id === 'de_w_r1_m1')!;
    applyDoubleElimResult(m, 'de_w_r1_m1', 'p1');
    const wf = m.find((x) => x.id === w1.nextMatchId)!;
    const lr1 = m.find((x) => x.id === w1.loserNextMatchId)!;
    expect(wf.participant1Id ?? wf.participant2Id).toBe('p1');
    expect(lr1.participant1Id ?? lr1.participant2Id).toBe('p4');
  });

  it('GF: si gana WB winner, torneo termina sin reset', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const gf = m.find((x) => x.id === 'de_gf')!;
    gf.participant1Id = 'pwb'; // wb winner
    gf.participant2Id = 'plb'; // lb winner
    const r = applyDoubleElimResult(m, 'de_gf', 'pwb');
    expect(r.tournamentEnds).toBe(true);
    expect(r.winnerAdvancedTo).toBe(null);
  });

  it('GF: si gana LB winner, va al reset', () => {
    const m = generateDoubleElim({ seeds: mkSeeds(4) });
    const gf = m.find((x) => x.id === 'de_gf')!;
    gf.participant1Id = 'pwb';
    gf.participant2Id = 'plb';
    const r = applyDoubleElimResult(m, 'de_gf', 'plb');
    expect(r.tournamentEnds).toBe(false);
    expect(r.winnerAdvancedTo).toBe('de_gfr');
    const reset = m.find((x) => x.id === 'de_gfr')!;
    expect(reset.participant1Id).toBe('pwb');
    expect(reset.participant2Id).toBe('plb');
  });
});
