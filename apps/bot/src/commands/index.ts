import type { SlashCommand } from '../lib/types.js';
import ping from './ping.js';
import tournament from './tournament/index.js';
import match from './match/index.js';
import leaderboard from './leaderboard/index.js';
import score from './score/index.js';
import dev from './dev/index.js';

export const commands: SlashCommand[] = [ping, tournament, match, leaderboard, score, dev];
// /dev queda siempre registrado pero su execute() chequea ADMIN_DISCORD_IDS:
// si el user no está en la lista, devuelve un mensaje y no hace nada.

export const commandMap = new Map<string, SlashCommand>(
  commands.map((c) => [c.data.name, c]),
);
