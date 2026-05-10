// Standard tournament seeding (NCAA-style).
// size=2:  [1, 2]
// size=4:  [1, 4, 2, 3]
// size=8:  [1, 8, 4, 5, 2, 7, 3, 6]
// size=16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]

export function standardSeeding(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`Bracket size must be a power of 2 ≥ 2, got ${size}`);
  }
  if (size === 2) return [1, 2];
  const half = standardSeeding(size / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

export function nextPowerOfTwo(n: number): number {
  if (n < 2) return 2;
  return 2 ** Math.ceil(Math.log2(n));
}
