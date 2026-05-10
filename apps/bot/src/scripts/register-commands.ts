// Registra los slash commands en Discord (global o por guild).
// Uso:
//   pnpm --filter @camibot/bot register                  # global (tarda ~1h en propagar)
//   pnpm --filter @camibot/bot register -- --guild=ID    # instantáneo, solo para dev

import { REST, Routes } from 'discord.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { commands } from '../commands/index.js';

const guildArg = process.argv.find((a) => a.startsWith('--guild='));
const guildId = guildArg?.split('=')[1];

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

const body = commands.map((c) => c.data.toJSON());

async function main() {
  try {
    if (guildId) {
      logger.info(`Registrando ${body.length} comandos en guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body });
    } else {
      logger.info(`Registrando ${body.length} comandos globalmente...`);
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    }
    logger.info('Comandos registrados.');
  } catch (err) {
    logger.error({ err }, 'Fallo registrando comandos');
    process.exit(1);
  }
}

main();
