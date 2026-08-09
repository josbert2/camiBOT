import { prisma } from '@camibot/db';
import type { Session } from 'next-auth';
import { discordAvatarUrl } from '@/lib/community';

type NotifType = 'LIKE' | 'COMMENT' | 'MENTION';

/** Crea una notificación. No se notifica a uno mismo. Best-effort (no rompe el flujo). */
export async function notify(input: {
  userId: string;
  actorId: string | null;
  type: NotifType;
  postId?: string | null;
  commentId?: string | null;
}): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
      },
    });
  } catch {
    // Una noti que falla no debe romper el like/comentario.
  }
}

/** Resuelve @usuarios de un texto a userIds (para notificar menciones). */
export async function resolveMentions(body: string): Promise<string[]> {
  const usernames = [...body.matchAll(/@([\w.]{2,32})/g)].map((m) => m[1]!.toLowerCase());
  if (usernames.length === 0) return [];
  const uniq = [...new Set(usernames)];
  const users = await prisma.user.findMany({
    where: { username: { in: uniq, mode: 'insensitive' } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export type NotifItem = {
  id: string;
  type: NotifType;
  read: boolean;
  createdAt: string;
  postId: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
};

export async function getNotifications(
  session: Session | null | undefined,
): Promise<{ items: NotifItem[]; unread: number }> {
  const userId = session?.user?.id;
  if (!userId) return { items: [], unread: 0 };

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        actor: {
          select: { globalName: true, username: true, nickname: true, discordId: true, avatar: true },
        },
      },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type as NotifType,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
      postId: r.postId,
      actor: r.actor
        ? {
            name: r.actor.nickname ?? r.actor.globalName ?? r.actor.username,
            avatarUrl: discordAvatarUrl(r.actor.discordId, r.actor.avatar),
          }
        : null,
    })),
    unread,
  };
}

export async function markAllRead(session: Session | null | undefined): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
