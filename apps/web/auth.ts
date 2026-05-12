// Auth.js completo — usado en route handlers, server actions y server components.
// El middleware (Edge) usa auth.config.ts (sin Prisma).
//
// IMPORTANTE: NO usamos PrismaAdapter. Nuestro modelo User tiene discordId @unique
// y campos custom; el PrismaAdapter espera tablas Account/Session/VerificationToken
// que no existen en este schema. En su lugar:
//   - Estrategia JWT (sin Session table)
//   - signIn callback hace upsert manual del User
//   - jwt callback resuelve el cuid del User y lo guarda en el token
//   - session callback expone session.user.id y session.user.discordId

import NextAuth from 'next-auth';
import type { DiscordProfile } from 'next-auth/providers/discord';
import { prisma } from '@camibot/db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ profile, account }) {
      if (!profile || account?.provider !== 'discord') return false;
      const discordProfile = profile as DiscordProfile;
      const discordId = discordProfile.id;
      if (!discordId) return false;

      await prisma.user.upsert({
        where: { discordId },
        create: {
          discordId,
          username: discordProfile.username ?? `user_${discordId}`,
          globalName: discordProfile.global_name ?? null,
          avatar: discordProfile.avatar ?? null,
          email: discordProfile.email ?? null,
          accessToken: account?.access_token ?? null,
          refreshToken: account?.refresh_token ?? null,
          tokenExpires: account?.expires_at
            ? new Date(account.expires_at * 1000)
            : null,
        },
        update: {
          username: discordProfile.username ?? undefined,
          globalName: discordProfile.global_name ?? null,
          avatar: discordProfile.avatar ?? null,
          email: discordProfile.email ?? null,
          accessToken: account?.access_token ?? null,
          refreshToken: account?.refresh_token ?? null,
          tokenExpires: account?.expires_at
            ? new Date(account.expires_at * 1000)
            : null,
        },
      });

      return true;
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordId = (profile as DiscordProfile).id;
        token.discordId = discordId;
        token.accessToken = account.access_token;
        const dbUser = await prisma.user.findUnique({
          where: { discordId },
          select: { id: true },
        });
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        if (token.discordId) session.user.discordId = token.discordId as string;
        if (token.userId) session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
