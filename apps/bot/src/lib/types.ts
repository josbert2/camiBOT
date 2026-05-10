import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ButtonHandler {
  customIdPrefix: string;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface ModalHandler {
  customIdPrefix: string;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}
