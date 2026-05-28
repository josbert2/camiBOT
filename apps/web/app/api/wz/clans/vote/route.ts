import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { getRequestIpHash } from '@/lib/ip';

const MAX_VOTES_PER_IP = 5;

const voteSchema = z.object({
  clanNameId: z.string().min(1),
  action: z.enum(['add', 'remove']).default('add'),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  const { clanNameId, action } = parsed.data;

  const target = await prisma.clanName.findUnique({
    where: { id: clanNameId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Ese clan no existe.' }, { status: 404 });
  }

  const ipHash = await getRequestIpHash();

  if (action === 'remove') {
    await prisma.clanVote.deleteMany({
      where: { ipHash, clanNameId },
    });
    const myVoteIds = await listMyVoteIds(ipHash);
    return NextResponse.json({ ok: true, removed: true, myVoteIds });
  }

  // add: chequear cuota
  const current = await prisma.clanVote.findMany({
    where: { ipHash },
    select: { clanNameId: true },
  });

  if (current.some((v) => v.clanNameId === clanNameId)) {
    return NextResponse.json({
      ok: true,
      unchanged: true,
      myVoteIds: current.map((v) => v.clanNameId),
    });
  }

  if (current.length >= MAX_VOTES_PER_IP) {
    return NextResponse.json(
      {
        error: `Ya usaste tus ${MAX_VOTES_PER_IP} votos. Quitá uno para votar a otro.`,
        myVoteIds: current.map((v) => v.clanNameId),
      },
      { status: 409 },
    );
  }

  await prisma.clanVote.create({
    data: { clanNameId, ipHash },
  });

  return NextResponse.json({
    ok: true,
    added: true,
    myVoteIds: [...current.map((v) => v.clanNameId), clanNameId],
  });
}

async function listMyVoteIds(ipHash: string): Promise<string[]> {
  const rows = await prisma.clanVote.findMany({
    where: { ipHash },
    select: { clanNameId: true },
  });
  return rows.map((r) => r.clanNameId);
}
