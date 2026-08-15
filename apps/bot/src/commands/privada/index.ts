import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from '@camibot/db';
import type { SlashCommand } from '../../lib/types.js';
import { upsertUser } from '../../lib/db-helpers.js';
import { buildPrivadaPanel } from '../../lib/private-match-panel.js';
import { logger } from '../../lib/logger.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('privada')
    .setDescription('Armar privadas (scrims) y apuntarse')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('crear')
        .setDescription('[admin] Crea una privada y postea el panel para apuntarse')
        .addStringOption((o) =>
          o.setName('nombre').setDescription('Nombre de la privada').setRequired(true),
        )
        .addStringOption((o) => o.setName('link').setDescription('Link de la sala / invite de Discord'))
        .addStringOption((o) => o.setName('premio').setDescription('Premio (opcional)'))
        .addIntegerOption((o) =>
          o.setName('cupo').setDescription('Cupo máximo (ej: 50)').setMinValue(2).setMaxValue(200),
        )
        .addIntegerOption((o) =>
          o
            .setName('squad')
            .setDescription('Tamaño de equipo')
            .addChoices(
              { name: 'Solos', value: 1 },
              { name: 'Dúos', value: 2 },
              { name: 'Tríos', value: 3 },
              { name: 'Cuartetos', value: 4 },
            ),
        )
        .addBooleanOption((o) =>
          o.setName('inscripcion').setDescription('¿Con inscripción? Por defecto sí'),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'crear') return handleCrear(interaction);
  },
};

function isAdminMember(interaction: ChatInputCommandInteraction): boolean {
  const adminIds = (process.env.ADMIN_DISCORD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const member = interaction.member;
  const hasManageEvents =
    member &&
    'permissions' in member &&
    typeof member.permissions !== 'string' &&
    member.permissions.has(PermissionFlagsBits.ManageEvents);
  return adminIds.includes(interaction.user.id) || Boolean(hasManageEvents);
}

async function handleCrear(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  if (!isAdminMember(interaction)) {
    await interaction.reply({
      content: 'Solo admins (Manage Events o ADMIN_DISCORD_IDS).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const name = interaction.options.getString('nombre', true).trim();
  const link = interaction.options.getString('link')?.trim() || null;
  const prize = interaction.options.getString('premio')?.trim() || null;
  const maxPlayers = interaction.options.getInteger('cupo');
  const squadSize = interaction.options.getInteger('squad') ?? 1;
  const hasSignup = interaction.options.getBoolean('inscripcion') ?? true;

  await interaction.deferReply();

  const creator = await upsertUser(interaction.user);
  const match = await prisma.privateMatch.create({
    data: { name, link, prize, maxPlayers, squadSize, hasSignup, createdById: creator.id },
    select: { id: true },
  });

  // Pre-creamos los slots de equipo vacíos (la gente se une donde quiera).
  if (squadSize > 1) {
    const base = maxPlayers ?? squadSize * 12;
    const n = Math.min(30, Math.max(2, Math.ceil(base / squadSize)));
    await prisma.privateSquad.createMany({
      data: Array.from({ length: n }, (_, i) => ({ matchId: match.id, name: `Equipo ${i + 1}` })),
    });
  }

  const panel = await buildPrivadaPanel(match.id);
  if (!panel) {
    await interaction.editReply({ content: 'No pude armar el panel.' });
    return;
  }

  const msg = await interaction.editReply({ embeds: [panel.embed], components: panel.rows });
  // Guardamos el mensaje del panel para poder refrescarlo desde los botones.
  await prisma.privateMatch.update({
    where: { id: match.id },
    data: { channelId: interaction.channelId, messageId: msg.id },
  });
  logger.info({ matchId: match.id, by: interaction.user.id }, 'Privada creada');
}

export default command;
