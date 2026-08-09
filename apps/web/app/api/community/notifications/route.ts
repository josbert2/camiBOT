import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getNotifications, markAllRead } from '@/lib/notifications';

/** Lista de notificaciones + contador de no leídas. */
export async function GET() {
  const session = await auth();
  return NextResponse.json(await getNotifications(session));
}

/** Marca todas como leídas. */
export async function POST() {
  const session = await auth();
  await markAllRead(session);
  return NextResponse.json({ ok: true });
}
