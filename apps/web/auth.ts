// Full Auth.js config con PrismaAdapter. Usar en server actions y route handlers.
// El middleware Edge usa auth.config.ts (sin Prisma).

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@camibot/db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});
