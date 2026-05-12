import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { prisma } from '@camibot/db';

const STATUS_LABEL: Record<string, string> = {
  WINNERS: 'WB',
  LOSERS: 'LB',
  GRAND_FINAL: 'GF',
};

/**
 * Construye el embed + filas de botones para el panel admin de un torneo.
 * Cada match READY tiene 2 botones: gana P1 / gana P2.
 * Discord limita a 5 botones/row y 5 rows/mensaje (25 botones, ~12 matches).
 */
export async function buildMatchPanel(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        include: {
          participant1: { include: { user: true } },
          participant2: { include: { user: true } },
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      },
      participants: { include: { user: true }, orderBy: { seed: 'asc' } },
    },
  });
  if (!tournament) return null;

  // Priorizamos DISPUTED, después READY. Mezclamos ambos (max 12 entre los dos).
  const disputed = tournament.matches.filter((m) => m.status === 'DISPUTED');
  const ready = tournament.matches.filter((m) => m.status === 'READY');
  const inProgress = tournament.matches.filter((m) => m.status === 'IN_PROGRESS');
  const actionable = [...disputed, ...ready].slice(0, 12);
  const pending = tournament.matches.filter((m) => m.status === 'PENDING').length;
  const completed = tournament.matches.filter((m) => m.status === 'COMPLETED').length;

  const description = actionable.length
    ? actionable
        .map((m, idx) => {
          const side = m.bracketSide !== 'WINNERS' ? ` (${STATUS_LABEL[m.bracketSide]})` : '';
          const p1 = nameOf(m.participant1) ?? '?';
          const p2 = nameOf(m.participant2) ?? '?';
          const s1 = m.participant1?.seed ?? '–';
          const s2 = m.participant2?.seed ?? '–';
          const tag = m.status === 'DISPUTED' ? '⚠️ DISPUTED ' : '';
          return `**${idx + 1}.** ${tag}R${m.round}.${m.matchNumber}${side} — \`${s1}\` ${p1} **vs** ${p2} \`${s2}\``;
        })
        .join('\n')
    : '_No hay matches para resolver ahora mismo._';

  const partList = tournament.participants
    .map((p) => {
      const wl = `${p.wins}W·${p.losses}L`;
      const tag =
        p.status === 'WINNER'
          ? '🏆 '
          : p.status === 'ELIMINATED'
            ? '❌ '
            : '';
      return `\`${String(p.seed ?? '–').padStart(2, '0')}\` ${tag}${nameOfRaw(p)} · ${wl}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🛠 Panel — ${tournament.name}`)
    .setColor(0x5865f2)
    .setDescription(description)
    .addFields(
      {
        name: `Participantes (${tournament.participants.length})`,
        value: truncate(partList, 1000) || '_vacío_',
      },
      {
        name: 'Stats',
        value: `Estado: \`${tournament.status}\` · Formato: \`${tournament.format}\`\nMatches: ${completed} completos · ${ready.length} READY · ${inProgress.length} esperando 2° reporte · ${disputed.length} ⚠️ disputas · ${pending} pendientes`,
      },
    );

  // Filas de botones (2 por match) — incluye DISPUTED y READY
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < actionable.length; i++) {
    const m = actionable[i]!;
    const p1Name = trimBtn(nameOf(m.participant1));
    const p2Name = trimBtn(nameOf(m.participant2));
    const isDisputed = m.status === 'DISPUTED';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`match:admin-win:${m.id}:p1`)
        .setLabel(`${i + 1}. ${isDisputed ? '⚠️ ' : ''}Gana ${p1Name}`)
        .setStyle(isDisputed ? ButtonStyle.Primary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`match:admin-win:${m.id}:p2`)
        .setLabel(`${i + 1}. ${isDisputed ? '⚠️ ' : ''}Gana ${p2Name}`)
        .setStyle(isDisputed ? ButtonStyle.Primary : ButtonStyle.Danger),
    );
    rows.push(row);
    if (rows.length >= 5) break; // límite Discord
  }

  // Última fila: botón refrescar
  if (rows.length < 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`match:admin-refresh:${tournament.id}`)
          .setLabel('🔄 Refrescar panel')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return { embed, rows };
}

function nameOf(
  p: { user: { username: string; globalName: string | null } } | null,
): string | null {
  if (!p) return null;
  return p.user.globalName ?? p.user.username;
}

function nameOfRaw(p: { user: { username: string; globalName: string | null } }): string {
  return p.user.globalName ?? p.user.username;
}

function trimBtn(s: string | null): string {
  if (!s) return '?';
  return s.length > 30 ? s.slice(0, 29) + '…' : s;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}
