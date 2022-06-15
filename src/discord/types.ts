import type { AppContext } from '../di'

// enums
import {
  InteractionType,
  InteractionResponseType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ButtonStyle,
  APIMessageComponent as MessageComponent,
  ComponentType,
} from 'discord-api-types/v10'

// enums
export {
  InteractionType,
  InteractionResponseType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ButtonStyle,
  ComponentType,
}

import type {
  APIGuildMember as DiscordGuildMember,
  APIUser as DiscordUser,
  APIApplicationCommand,
  //command definitions
  APIApplicationCommandOption as CommandOption,
  APIApplicationCommandSubcommandOption as CommandSubcommandOption,
  APIApplicationCommandSubcommandGroupOption as CommandSubcommandGroupOption,
  APIApplicationCommandBasicOption as CommandBasicOption,
  APIApplicationCommandStringOption as CommandStringOption,
  APIApplicationCommandIntegerOption as CommandIntegerOption,
  APIApplicationCommandBooleanOption as CommandBooleanOption,
  APIApplicationCommandUserOption as CommandUserOption,
  APIApplicationCommandChannelOption as CommandChannelOption,
  APIApplicationCommandRoleOption as CommandRoleOption,
  APIApplicationCommandMentionableOption as CommandMentionableOption,
  APIApplicationCommandNumberOption as CommandNumberOption,
  APIApplicationCommandAttachmentOption as CommandAttachmentOption,

  // interaction inputs
  APIInteraction as Interaction,
  APIMessageComponentInteraction as MessageComponentInteraction,
  APIMessageComponentButtonInteraction as MessageButtonInteraction,
  APIApplicationCommandInteraction as ApplicationCommandInteraction,
  APIChatInputApplicationCommandInteraction as ChatInputInteraction,
  APIContextMenuInteraction as ContextMenuInteraction,
  APIInteractionResponse as InteractionResponse,
  APIInteractionResponseCallbackData as InteractionResponseCallback,
  APIApplicationCommandInteractionDataOption as CommandInteractionOption,
  APIApplicationCommandInteractionDataSubcommandOption as CommandInteractionSubCommand,
  APIApplicationCommandInteractionDataStringOption as CommandInteractionString,
  APIApplicationCommandInteractionDataIntegerOption as CommandInteractionInteger,
  APIApplicationCommandInteractionDataBooleanOption as CommandInteractionBoolean,
  APIApplicationCommandInteractionDataUserOption as CommandInteractionUser,
  APIApplicationCommandInteractionDataChannelOption as CommandInteractionChannel,
  APIApplicationCommandInteractionDataRoleOption as CommandInteractionRole,
  APIApplicationCommandInteractionDataMentionableOption as CommandInteractionMentionable,
  APIApplicationCommandInteractionDataNumberOption as CommandInteractionNumber,
  APIApplicationCommandInteractionDataAttachmentOption as CommandInteractionAttachment,
  APIInteractionResponseChannelMessageWithSource,
  APIInteractionResponseDeferredChannelMessageWithSource,
  APIInteractionResponseDeferredMessageUpdate,
  APIInteractionResponseUpdateMessage,
  APIActionRowComponent,
  APIMessageActionRowComponent,
} from 'discord-api-types/v10'

export type {
  Interaction,
  InteractionResponse,
  InteractionResponseCallback,
  MessageComponent,
  //command definitions
  APIApplicationCommand as Command,
  CommandOption,
  CommandSubcommandOption,
  CommandSubcommandGroupOption,
  CommandBasicOption,
  CommandStringOption,
  CommandIntegerOption,
  CommandBooleanOption,
  CommandUserOption,
  CommandChannelOption,
  CommandRoleOption,
  CommandMentionableOption,
  CommandNumberOption,
  CommandAttachmentOption,
  // interaction inputs
  MessageComponentInteraction,
  MessageButtonInteraction,
  ApplicationCommandInteraction,
  ChatInputInteraction,
  ContextMenuInteraction,
  CommandInteractionOption,
  CommandInteractionSubCommand,
  CommandInteractionString,
  CommandInteractionInteger,
  CommandInteractionBoolean,
  CommandInteractionUser,
  CommandInteractionChannel,
  CommandInteractionRole,
  CommandInteractionMentionable,
  CommandInteractionNumber,
  CommandInteractionAttachment,
}

// ---------------------------------
// Extended Discord Types
// ---------------------------------

export type DiscordGuildMemberWithUser = Omit<DiscordGuildMember, 'user'> & {
  user: DiscordUser
}

/** App-extended type for Guild Members with non-optional ids*/
export interface GuildMember {
  id: string
  guildId: string
  username: string
  /** When the user joined the guild */
  joinedAt: string
}

// ---------------------------------
// Slash Command Definition
// ---------------------------------

export interface SlashCommandOptions<T extends (CommandInteractionOption | undefined)[]>
  extends Omit<ChatInputInteraction, 'data'> {
  data: Omit<CommandInteractionOption, 'options'> & {
    options: T
  }
}

export type SlashSubCommandOptions<T extends (CommandInteractionOption | undefined)[]> = Omit<
  CommandInteractionSubCommand,
  'options'
> & {
  options?: T
}

export interface BaseCommand {
  // The name of the command. Needs to be unique across all commands
  id: string
  /** The description of the command. */
  description?: string
  /** Whether or not this slash command should be enabled right now. Defaults to true. */
  enabled?: boolean
  /** Whether this slash command should be created per guild. Defaults to true. */
  guild?: boolean
  /** Whether this slash command should be created once globally and allowed in DMs. Defaults to false. */
  global?: boolean
}

export interface SlashCommand<Type extends SlashCommandInteraction> extends BaseCommand {
  /** The slash command options for this command. */
  options?: CommandOption[]
  /** The function that will be called when the command is executed. */
  handleSlashCommand: (payload: Type, context: AppContext) => Promise<CommandResponse>
}

export interface MessageComponentCommand extends BaseCommand {
  messageInteractionType: string
  handleMessage: (
    payload: MessageComponentInteraction,
    context: AppContext
  ) => Promise<CommandResponse>
}

export type SlashCommandInteraction = SlashCommandOptions<(CommandInteractionOption | undefined)[]>
// ---------------------------------
// Command Response
// ---------------------------------

export type CommandResponse = InteractionResponse | Promise<InteractionResponse>
export type MessageResponse =
  | APIInteractionResponseChannelMessageWithSource
  | APIInteractionResponseDeferredChannelMessageWithSource
  | APIInteractionResponseDeferredMessageUpdate
  | APIInteractionResponseUpdateMessage
export type MessageComponents = APIActionRowComponent<APIMessageActionRowComponent>[]

export function isInteractionResponse(
  response: InteractionResponse | InteractionResponseCallback
): response is InteractionResponse {
  return Reflect.has(response, 'type')
}
