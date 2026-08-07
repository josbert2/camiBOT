import type { Metadata } from 'next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Message01Icon } from '@hugeicons/core-free-icons';
import { auth } from '@/auth';
import { getDiscussionFeed } from '@/lib/community';
import { isR2Configured } from '@/lib/r2';
import { LoginProvider } from '../comunidad/login-gate';
import { DiscussionComposer } from './discussion-composer';
import { DiscussionFeed } from './discussion-feed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discusión — Tournify',
  description: 'Abrí temas, compartí pruebas y reportá. Con opción de post anónimo.',
};

export default async function DiscusionPage() {
  const session = await auth();
  const { posts, nextCursor } = await getDiscussionFeed(session);
  const isAuthed = !!session?.user?.id;
  const r2Ready = isR2Configured();

  return (
    <LoginProvider>
      <main className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <header className="mb-6 border-b border-border pb-4">
          <div className="mb-2 flex items-center gap-2 tag-tactical">
            <HugeiconsIcon icon={Message01Icon} className="h-3.5 w-3.5" />
            <span>// TRIBUNAL</span>
          </div>
          <h1 className="stencil text-4xl md:text-5xl">Discusión</h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
            Abrí temas · compartí pruebas · reportá — podés hacerlo anónimo
          </p>
        </header>

        <DiscussionComposer isAuthed={isAuthed} r2Ready={r2Ready} />
        <DiscussionFeed initialPosts={posts} initialCursor={nextCursor} isAuthed={isAuthed} />
      </main>
    </LoginProvider>
  );
}
