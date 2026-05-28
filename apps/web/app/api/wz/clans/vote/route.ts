import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { getRequestIpHash } from '@/lib/ip';

const VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const voteSchema = z.object({
  clanNameId: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  const { clanNameId } = parsed.data;

  const target = await prisma.clanName.findUnique({
    where: { id: clanNameId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Ese clan no existe.' }, { status: 404 });
  }

  const ipHash = await getRequestIpHash();
  const existing = await prisma.clanVote.findUnique({
    where: { ipHash },
    select: { clanNameId: true, updatedAt: true },
  });

  if (existing) {
    if (existing.clanNameId === clanNameId) {
      return NextResponse.json({ ok: true, clanNameId, unchanged: true });
    }
    const elapsed = Date.now() - existing.updatedAt.getTime();
    if (elapsed < VOTE_COOLDOWN_MS) {
      const remaining = Math.ceil((VOTE_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `Ya votaste hace poco. Podés cambiar tu voto en ${remaining}h.`,
          unlockAt: new Date(existing.updatedAt.getTime() + VOTE_COOLDOWN_MS).toISOString(),
        },
        { status: 429 },
      );
    }
    await prisma.clanVote.update({
      where: { ipHash },
      data: { clanNameId },
    });
    return NextResponse.json({ ok: true, clanNameId, changed: true });
  }

  await prisma.clanVote.create({
    data: { clanNameId, ipHash },
  });
  return NextResponse.json({ ok: true, clanNameId, created: true });
}
