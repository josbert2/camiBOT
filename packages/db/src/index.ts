// Edge-compatible: nada de Node APIs acá. El consumidor (bot vía env.ts,
// web vía symlink .env → root) se asegura de que DATABASE_URL exista en
// process.env antes de importar este módulo.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
