import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { fetchPrivadaRow } from '@/lib/privadas';
import { Lobby } from './lobby';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lobby — Privada',
  description: 'Lobby de la privada: equipos, capitanes y apuntados.',
};

export default async function PrivadaLobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const meId = session?.user?.id ?? null;

  const row = await fetchPrivadaRow(id, meId);
  if (!row) notFound();

  return <Lobby row={row} isAdmin={isAdmin(session)} isLoggedIn={Boolean(meId)} />;
}
