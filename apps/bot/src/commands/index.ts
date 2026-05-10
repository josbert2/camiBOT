import type { SlashCommand } from '../lib/types.js';
import ping from './ping.js';
import tournament from './tournament/index.js';
import match from './match/index.js';

export const commands: SlashCommand[] = [ping, tournament, match];

export const commandMap = new Map<string, SlashCommand>(
  commands.map((c) => [c.data.name, c]),
);
