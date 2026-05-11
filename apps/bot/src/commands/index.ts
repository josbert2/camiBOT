import type { SlashCommand } from '../lib/types.js';
import ping from './ping.js';
import tournament from './tournament/index.js';
import match from './match/index.js';
import dev from './dev/index.js';

export const commands: SlashCommand[] = [ping, tournament, match];
// El /dev solo se registra cuando no estamos en producción.
if (process.env.NODE_ENV !== 'production') commands.push(dev);

export const commandMap = new Map<string, SlashCommand>(
  commands.map((c) => [c.data.name, c]),
);
