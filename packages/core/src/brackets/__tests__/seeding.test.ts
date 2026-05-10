import { describe, it, expect } from 'vitest';
import { standardSeeding, nextPowerOfTwo } from '../seeding.js';

describe('standardSeeding', () => {
  it('size 2', () => {
    expect(standardSeeding(2)).toEqual([1, 2]);
  });

  it('size 4', () => {
    expect(standardSeeding(4)).toEqual([1, 4, 2, 3]);
  });

  it('size 8', () => {
    expect(standardSeeding(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('size 16', () => {
    expect(standardSeeding(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });

  it('throws on non-power-of-2', () => {
    expect(() => standardSeeding(6)).toThrow();
    expect(() => standardSeeding(3)).toThrow();
  });
});

describe('nextPowerOfTwo', () => {
  it.each([
    [1, 2],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [9, 16],
    [16, 16],
    [17, 32],
  ])('nextPowerOfTwo(%i) === %i', (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });
});
