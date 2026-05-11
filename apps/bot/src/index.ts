import { Client, GatewayIntentBits } from 'discord.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { registerEvents } from './events/index.js';

const client = new Client({
  // Solo Guilds — slash commands y botones no necesitan más.
  // GuildMembers y MessageContent son privileged intents que requieren activarse
  // en el dev portal. Por ahora no nos hacen falta.
  intents: [GatewayIntentBits.Guilds],
});

registerEvents(client);

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down...`);
  await client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(env.DISCORD_TOKEN).catch((err) => {
  logger.fatal({ err }, 'Login fallido');
  process.exit(1);
});
