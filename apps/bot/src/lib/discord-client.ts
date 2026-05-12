import type { Client } from 'discord.js';

let _client: Client | null = null;

export function setDiscordClient(c: Client): void {
  _client = c;
}

export function getDiscordClient(): Client | null {
  return _client;
}
