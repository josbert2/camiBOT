'use server';

import { signIn } from '@/auth';

/** Login con Discord desde el modal del feed. Vuelve a /comunidad. */
export async function loginWithDiscord() {
  await signIn('discord', { redirectTo: '/comunidad' });
}
