// Config mínimo de Auth.js compatible con Edge Runtime.
// El middleware lo usa directamente (no puede importar Prisma).
// El `auth.ts` completo (con PrismaAdapter) se usa para las routes/server actions.

import type { NextAuthConfig } from 'next-auth';
import Discord from 'next-auth/providers/discord';

export const authConfig: NextAuthConfig = {
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: 'identify email guilds' } },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.discordId = profile.id as string;
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.discordId && session.user) {
        session.user.discordId = token.discordId as string;
      }
      return session;
    },
  },
};
