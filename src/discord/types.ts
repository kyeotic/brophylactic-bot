import type {
  GuildMember as DiscordGuildMember,
  InteractionApplicationCommandCallbackData,
  ApplicationCommandOption,
  Interaction,
  InteractionResponse,
  SlashCommandInteraction,
  ApplicationCommandInteractionData,
  ApplicationCommandInteractionDataOptionSubCommand,
  ApplicationCommandInteractionDataOption,
} from 'discordeno'
import type { AppContext } from '../di'

export type {
  ApplicationCommandInteractionDataOptionSubCommand,
  ApplicationCommandInteractionDataOption,
  ApplicationCommandInteractionDataOptionString,
  ApplicationCommandInteractionDataOptionBoolean,
  ApplicationCommandInteractionDataOptionInteger,
  ApplicationCommandInteractionDataOptionUser,
  ApplicationCommandInteractionDataOptionChannel,
  ApplicationCommandInteractionDataOptionRole,
  ApplicationCommandInteractionDataOptionMentionable,
  GuildMemberWithUser,
  InteractionResponse,
  Interaction,
  ComponentInteraction,
  InteractionApplicationCommandCallbackData,
  MessageComponents,
  SlashCommandInteraction,
} from 'discordeno'

export type { DiscordGuildMember }

/** App-extended type for Guild Members with non-optional ids*/
export interface GuildMember {
  id: string
  guildId: string
  username: string
  /** When the user joined the guild */
  joinedAt: string
}

export type CommandResponse =
  | InteractionResponse
  | InteractionApplicationCommandCallbackData
  | Promise<InteractionResponse | InteractionApplicationCommandCallbackData>

export interface Command {
  /** The description of the command. */
  description?: string
  /** Whether or not this slash command should be enabled right now. Defaults to true. */
  enabled?: boolean
  /** Whether this slash command should be created per guild. Defaults to true. */
  guild?: boolean
  /** Whether this slash command should be created once globally and allowed in DMs. Defaults to false. */
  global?: boolean
  /** The slash command options for this command. */
  options?: ApplicationCommandOption[]
  /** The function that will be called when the command is executed. */
  execute: (payload: Interaction, context: AppContext) => CommandResponse
  messageInteractionType?: string
}

export function isInteractionResponse(
  response: InteractionResponse | InteractionApplicationCommandCallbackData
): response is InteractionResponse {
  return Reflect.has(response, 'type')
}

export interface SlashCommand<T extends (ApplicationCommandInteractionDataOption | undefined)[]>
  extends Omit<SlashCommandInteraction, 'data'> {
  data: Omit<ApplicationCommandInteractionData, 'options'> & {
    options: T
  }
}

export type SlashSubCommand<T extends (ApplicationCommandInteractionDataOption | undefined)[]> =
  Omit<ApplicationCommandInteractionDataOptionSubCommand, 'options'> & {
    options?: T
  }

// From discordeno

export enum DiscordInteractionTypes {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
}

export enum DiscordInteractionResponseTypes {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredUpdateMessage = 6,
  UpdateMessage = 7,
}

export enum ApplicationCommandOptionTypes {
  SubCommand = 1,
  SubCommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
}

export enum ButtonStyles {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
}

export enum MessageComponentTypes {
  ActionRow = 1,
  Button = 2,
  SelectMenu = 3,
}
