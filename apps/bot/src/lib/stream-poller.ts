import { EmbedBuilder, ChannelType, type Client } from 'discord.js';
import { prisma } from '@camibot/db';
import { logger } from './logger.js';
import { twitchLive, kickLive, tiktokLive, type LiveInfo } from './streams.js';

const INTERVAL_MS = 120_000; // cada 2 min
let timer: ReturnType<typeof setInterval> | null = null;

export function startStreamPoller(client: Client) {
  if (timer) return;
  const run = () => pollOnce(client).catch((err) => logger.error({ err }, 'stream poll fail'));
  timer = setInterval(run, INTERVAL_MS);
  setTimeout(run, 15_000); // primera corrida a los 15s del arranque
  logger.info('Stream poller iniciado (cada 2 min).');
}

export function stopStreamPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function pollOnce(client: Client) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ twitchLogin: { not: null } }, { kickSlug: { not: null } }, { tiktokUser: { not: null } }],
    },
    select: {
      id: true,
      username: true,
      globalName: true,
      nickname: true,
      twitchLogin: true,
      kickSlug: true,
      tiktokUser: true,
      livePlatform: true,
      liveStartedAt: true,
    },
  });
  if (!users.length) return;

  // Twitch en batch (una sola llamada para todos).
  const twitchLogins = users.map((u) => u.twitchLogin).filter((l): l is string => !!l).map((l) => l.toLowerCase());
  const twitch = await twitchLive(twitchLogins);

  for (const u of users) {
    let info: LiveInfo | null = null;
    if (u.twitchLogin) info = twitch.get(u.twitchLogin.toLowerCase()) ?? null;
    if (!info && u.kickSlug) info = await kickLive(u.kickSlug);
    if (!info && u.tiktokUser) info = await tiktokLive(u.tiktokUser);

    const wasLive = u.livePlatform != null;
    const isLive = info != null;

    if (isLive && info) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          livePlatform: info.platform,
          liveTitle: info.title,
          liveUrl: info.url,
          liveViewers: info.viewers,
          liveStartedAt: u.liveStartedAt ?? info.startedAt ?? new Date(),
          liveCheckedAt: new Date(),
        },
      });
      if (!wasLive) await announce(client, u, info);
    } else if (wasLive) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          livePlatform: null,
          liveTitle: null,
          liveUrl: null,
          liveViewers: null,
          liveStartedAt: null,
          liveCheckedAt: new Date(),
        },
      });
    } else {
      await prisma.user.update({ where: { id: u.id }, data: { liveCheckedAt: new Date() } });
    }
  }
}

const LABEL: Record<LiveInfo['platform'], string> = { twitch: 'Twitch', kick: 'Kick', tiktok: 'TikTok' };
const COLOR: Record<LiveInfo['platform'], number> = { twitch: 0x9146ff, kick: 0x53fc18, tiktok: 0xff0050 };

async function announce(
  client: Client,
  u: { username: string; globalName: string | null; nickname: string | null },
  info: LiveInfo,
) {
  const channelId = process.env.STREAM_ANNOUNCE_CHANNEL_ID;
  if (!channelId) return;
  const name = u.nickname ?? u.globalName ?? u.username;

  const embed = new EmbedBuilder()
    .setTitle(`🔴 ${name} está EN VIVO en ${LABEL[info.platform]}`)
    .setURL(info.url)
    .setColor(COLOR[info.platform])
    .setDescription(info.title || 'Entrá a ver el stream.')
    .setTimestamp(info.startedAt ?? new Date());
  if (info.viewers != null) embed.addFields({ name: 'Viewers', value: String(info.viewers), inline: true });

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (
    channel &&
    (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
  ) {
    await channel.send({ content: `🔴 **${name}** arrancó stream: ${info.url}`, embeds: [embed] }).catch(() => {});
    logger.info({ name, platform: info.platform }, 'Stream anunciado');
  }
}
