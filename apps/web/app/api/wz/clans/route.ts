import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@camibot/db';
import { getRequestIpHash } from '@/lib/ip';
import { containsProfanity, normalizeClanName, slugify } from '@/lib/profanity';

const REGISTER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_LEN = 3;
const MAX_LEN = 24;

const registerSchema = z.object({
  name: z.string().trim().min(MIN_LEN).max(MAX_LEN),
});

export async function GET() {
  const ipHash = await getRequestIpHash();

  const [clans, myVote] = await Promise.all([
    prisma.clanName.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { votes: true } },
      },
      orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'asc' }],
      take: 200,
    }),
    prisma.clanVote.findUnique({
      where: { ipHash },
      select: { clanNameId: true, updatedAt: true },
    }),
  ]);

  const lastRegister = await prisma.clanName.findFirst({
    where: { ipHash },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return NextResponse.json({
    clans: clans.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      votes: c._count.votes,
      createdAt: c.createdAt.toISOString(),
    })),
    myVoteId: myVote?.clanNameId ?? null,
    voteUnlockAt: myVote ? new Date(myVote.updatedAt.getTime() + REGISTER_COOLDOWN_MS).toISOString() : null,
    registerUnlockAt: lastRegister
      ? new Date(lastRegister.createdAt.getTime() + REGISTER_COOLDOWN_MS).toISOString()
      : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `El nombre tiene que tener entre ${MIN_LEN} y ${MAX_LEN} caracteres.` },
      { status: 400 },
    );
  }

  const name = parsed.data.name;

  if (containsProfanity(name)) {
    return NextResponse.json(
      { error: 'Ese nombre tiene palabras que no aceptamos. Probá otro.' },
      { status: 400 },
    );
  }

  const normalizedName = normalizeClanName(name);
  if (normalizedName.length < MIN_LEN) {
    return NextResponse.json(
      { error: 'El nombre no puede ser solo símbolos o espacios.' },
      { status: 400 },
    );
  }

  const ipHash = await getRequestIpHash();

  const lastRegister = await prisma.clanName.findFirst({
    where: { ipHash },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (lastRegister) {
    const elapsed = Date.now() - lastRegister.createdAt.getTime();
    if (elapsed < REGISTER_COOLDOWN_MS) {
      const remaining = Math.ceil((REGISTER_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `Ya registraste un nombre hace poco. Esperá ${remaining}h para registrar otro.`,
          unlockAt: new Date(lastRegister.createdAt.getTime() + REGISTER_COOLDOWN_MS).toISOString(),
        },
        { status: 429 },
      );
    }
  }

  const duplicate = await prisma.clanName.findUnique({
    where: { normalizedName },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'Ese nombre ya está registrado.' }, { status: 409 });
  }

  let slug = slugify(name);
  if (!slug) slug = `clan-${Date.now().toString(36)}`;
  const slugTaken = await prisma.clanName.findUnique({ where: { slug }, select: { id: true } });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const created = await prisma.clanName.create({
    data: { name, slug, normalizedName, ipHash },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  return NextResponse.json({
    clan: {
      id: created.id,
      name: created.name,
      slug: created.slug,
      votes: 0,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
