export type { BracketSeed, BracketMatch, BracketFormat, BracketSide } from '@camibot/types';
export { generateSingleElim, applyMatchResult } from './single-elim';
export {
  generateRoundRobin,
  computeStandings,
  type RoundRobinStanding,
  type CompletedRoundRobinMatch,
} from './round-robin';
export { generateDoubleElim, applyDoubleElimResult } from './double-elim';
export { renderBracketText, type RenderOptions } from './render';
export { standardSeeding, nextPowerOfTwo } from './seeding';
