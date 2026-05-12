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
export {
  generateSwissRoundOne,
  generateNextSwissRound,
  computeSwissStandings,
  defaultSwissRounds,
  type SwissParticipant,
  type SwissStanding,
  type CompletedSwissMatch,
} from './brackets/swiss';
export {
  splitIntoGroups,
  generateGroupStageMatches,
  generatePlayoffMatches,
  rankPlayoffsQualifiers,
  PLAYOFF_ROUND_OFFSET,
  type GroupStanding,
  type SplitGroupsResult,
} from './brackets/groups';
export { renderBracketText, type RenderOptions } from './brackets/render';
export { standardSeeding, nextPowerOfTwo } from './brackets/seeding';
