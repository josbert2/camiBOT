import { prisma, Prisma } from '@camibot/db';
import type { Session } from 'next-auth';
import { isAdmin } from '@/lib/admin';
import { publicUrl } from '@/lib/r2';

export const CAPTION_MAX = 280;
export const COMMENT_MAX = 500;
export const FEED_PAGE_SIZE = 5;

/** Modos que taggeamos. Cortos, para que entren en un chip del HUD. */
export const GAME_MODES = [
  'Warzone',
  'Resurgence',
  'Multijugador',
  'Ranked',
  'Zombies',
  'Otro',
] as const;

export type PostAuthor = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

export type FeedComment = {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthor;
  canDelete: boolean;
};

export type FeedPost = {
  id: string;
  slug: string | null;
  caption: string | null;
  videoUrl: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  weaponId: string | null;
  weaponName: string | null;
  gameMode: string | null;
  createdAt: string;
  author: PostAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  comments: FeedComment[];
};

/**
 * Normaliza un texto a slug ASCII (minúsculas, guiones). Devuelve null si
 * queda con menos de 3 chars útiles. Tope de 40.
 */
export function normalizeSlug(raw: string): string | null {
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s.length >= 3 ? s : null;
}

/** Avatar de Discord a partir del hash que guardamos en el User. */
export function discordAvatarUrl(discordId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}?size=128`;
}

/**
 * Puede borrar si es el autor o si es admin. Mismo criterio para posts
 * y para comentarios.
 */
export function canDelete(
  session: Session | null | undefined,
  authorId: string,
): boolean {
  if (!session?.user?.id) return false;
  return session.user.id === authorId || isAdmin(session);
}

const authorSelect = {
  id: true,
  discordId: true,
  username: true,
  globalName: true,
  nickname: true,
  avatar: true,
} as const;

type RawAuthor = {
  id: string;
  discordId: string;
  username: string;
  globalName: string | null;
  nickname: string | null;
  avatar: string | null;
};

function toAuthor(u: RawAuthor): PostAuthor {
  return {
    id: u.id,
    // El apodo elegido manda; si no, el nombre de Discord.
    name: u.nickname ?? u.globalName ?? u.username,
    username: u.username,
    avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
  };
}

export type NicknameStatus = { needsNickname: boolean; discordName: string };

/** Si el usuario logueado todavía no pasó por el prompt de apodo. */
export async function getNicknameStatus(
  session: Session | null | undefined,
): Promise<NicknameStatus | null> {
  const userId = session?.user?.id;
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nicknameSet: true, globalName: true, username: true },
  });
  if (!u) return null;
  return { needsNickname: !u.nicknameSet, discordName: u.globalName ?? u.username };
}

export type ProfileSummary = {
  author: PostAuthor;
  postCount: number;
  likesReceived: number;
};

/**
 * Likes recibidos (all-time) por cada usuario de la lista. Devuelve un Map
 * userId → cantidad. Para sumar puntos de comunidad en rankings ya armados.
 */
export async function getLikesByAuthor(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<{ authorId: string; likes: number }[]>`
    SELECT p."authorId", COUNT(*)::int AS likes
    FROM "PostLike" l
    JOIN "Post" p ON p.id = l."postId"
    WHERE p."authorId" IN (${Prisma.join(userIds)})
      AND p."removedAt" IS NULL
      AND p."status" = 'PUBLISHED'
    GROUP BY p."authorId"
  `;

  return new Map(rows.map((r) => [r.authorId, r.likes]));
}

/**
 * Datos del usuario logueado para la card de perfil del feed. null si no hay
 * sesión (la UI muestra el prompt de login en su lugar).
 */
export async function getProfileSummary(
  session: Session | null | undefined,
): Promise<ProfileSummary | null> {
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: authorSelect,
  });
  if (!user) return null;

  const [postCount, likesReceived] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, removedAt: null } }),
    prisma.postLike.count({ where: { post: { authorId: userId, removedAt: null } } }),
  ]);

  return { author: toAuthor(user), postCount, likesReceived };
}

export async function getFeed(
  session: Session | null | undefined,
  opts: { weaponId?: string; take?: number; cursor?: string } = {},
): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const take = opts.take ?? FEED_PAGE_SIZE;

  const rows = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      ...(opts.weaponId ? { weaponId: opts.weaponId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    // Pedimos uno de mas para saber si hay pagina siguiente sin un count().
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      author: { select: authorSelect },
      _count: { select: { likes: true, comments: { where: { removedAt: null } } } },
      likes: session?.user?.id
        ? { where: { userId: session.user.id }, select: { id: true } }
        : false,
      comments: {
        where: { removedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 3,
        include: { author: { select: authorSelect } },
      },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const posts = page.map((p): FeedPost => {
    const likes = p.likes as { id: string }[] | undefined;
    return {
      id: p.id,
      slug: p.slug,
      caption: p.caption,
      videoUrl: publicUrl(p.videoKey),
      posterUrl: p.posterKey ? publicUrl(p.posterKey) : null,
      width: p.width,
      height: p.height,
      durationSec: p.durationSec,
      weaponId: p.weaponId,
      weaponName: p.weaponName,
      gameMode: p.gameMode,
      createdAt: p.createdAt.toISOString(),
      author: toAuthor(p.author),
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: Array.isArray(likes) && likes.length > 0,
      canDelete: canDelete(session, p.authorId),
      comments: p.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: toAuthor(c.author),
        canDelete: canDelete(session, c.authorId),
      })),
    };
  });

  return {
    posts,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function getComments(
  session: Session | null | undefined,
  postId: string,
): Promise<FeedComment[]> {
  const rows = await prisma.postComment.findMany({
    where: { postId, removedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: authorSelect } },
  });

  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: toAuthor(c.author),
    canDelete: canDelete(session, c.authorId),
  }));
}
