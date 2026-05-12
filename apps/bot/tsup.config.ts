import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/register-commands.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  // Bundle workspace packages (que apuntan a .ts crudo) en el output.
  // Sin esto, en prod `node dist/index.js` revienta con
  // ERR_UNKNOWN_FILE_EXTENSION al importar @camibot/db (./src/index.ts).
  noExternal: ['@camibot/db', '@camibot/core', '@camibot/types'],
});
