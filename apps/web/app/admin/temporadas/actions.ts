'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@camibot/db';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { closeSeason } from '@/lib/season';

async function requireAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    throw new Error('No autorizado.');
  }
  return session.user.id;
}

export async function createSeason(formData: FormData) {
  const adminId = await requireAdminId();

  const name = String(formData.get('name') ?? '').trim();
  const prize = String(formData.get('prize') ?? '').trim() || 'Battle Pass BlackCell';
  const targetRaw = String(formData.get('targetPoints') ?? '').trim();
  const startsAt = new Date(String(formData.get('startsAt') ?? ''));
  const endsAt = new Date(String(formData.get('endsAt') ?? ''));

  if (!name) throw new Error('Falta el nombre de la temporada.');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Fechas inválidas.');
  }
  if (endsAt <= startsAt) throw new Error('La fecha de cierre debe ser posterior al inicio.');

  const targetPoints = targetRaw ? Math.max(1, parseInt(targetRaw, 10)) : null;

  await prisma.season.create({
    data: { name, prize, targetPoints, startsAt, endsAt, createdById: adminId },
  });

  revalidatePath('/admin/temporadas');
  revalidatePath('/comunidad');
}

export async function closeSeasonAction(formData: FormData) {
  await requireAdminId();
  const seasonId = String(formData.get('seasonId') ?? '');
  if (!seasonId) throw new Error('Falta la temporada.');

  await closeSeason(seasonId);

  revalidatePath('/admin/temporadas');
  revalidatePath('/comunidad');
}
