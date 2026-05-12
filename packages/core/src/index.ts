// Re-exports explícitos sin extensión para que Turbopack (Next 16) los resuelva
// tanto en TS (raw) como cuando se transpila.
export type {
  BracketSeed,
  BracketMatch,
  BracketFormat,
  BracketSide,
} from '@camibot/types';
export { generateSingleElim, applyMatchResult } from './brackets/single-elim';
export {
  generateRoundRobin,
  computeStandings,
  type RoundRobinStanding,
  type CompletedRoundRobinMatch,
} from './brackets/round-robin';
export {
  generateDoubleElim,
  applyDoubleElimResult,
} from './brackets/double-elim';
export { renderBracketText, type RenderOptions } from './brackets/render';
export { standardSeeding, nextPowerOfTwo } from './brackets/seeding';
