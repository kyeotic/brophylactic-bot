import type { AppContext } from '../di'
// enums
import {
  InteractionType,
  InteractionResponseType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ButtonStyle,
  APIMessageComponent as MessageComponentType,
} from 'discord-api-types/v10'

import type {
  APIGuildMember as DiscordGuildMember,
  APIUser as DiscordUser,
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
  APIChatInputApplicationCommandInteraction as SlashCommandInteraction,
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

  // debug
  APIChatInputApplicationCommandInteractionData,
  APIContextMenuInteraction,
} from 'discord-api-types/v10'

export type {
  Interaction,
  InteractionResponse,
  InteractionResponseCallback,
  //command definitions
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
  SlashCommandInteraction,
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

// enums
export {
  InteractionType,
  InteractionResponseType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ButtonStyle,
  MessageComponentType,
}

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

export interface Command<
  CommandInteractionType extends SlashCommand<(CommandInteractionOption | undefined)[]>
> {
  /** The description of the command. */
  description?: string
  /** Whether or not this slash command should be enabled right now. Defaults to true. */
  enabled?: boolean
  /** Whether this slash command should be created per guild. Defaults to true. */
  guild?: boolean
  /** Whether this slash command should be created once globally and allowed in DMs. Defaults to false. */
  global?: boolean
  /** The slash command options for this command. */
  options?: CommandOption[]
  /** The function that will be called when the command is executed. */
  execute: (payload: CommandInteractionType, context: AppContext) => CommandResponse
  messageInteractionType?: string
}
export type CommandInteraction = SlashCommand<(CommandInteractionOption | undefined)[]>

export type CommandResponse = InteractionResponse | Promise<InteractionResponse>
export type MessageResponse =
  | APIInteractionResponseChannelMessageWithSource
  | APIInteractionResponseDeferredChannelMessageWithSource
  | APIInteractionResponseDeferredMessageUpdate
  | APIInteractionResponseUpdateMessage

export function isInteractionResponse(
  response: InteractionResponse | InteractionResponseCallback
): response is InteractionResponse {
  return Reflect.has(response, 'type')
}

export interface SlashCommand<T extends (CommandInteractionOption | undefined)[]>
  extends Omit<SlashCommandInteraction, 'data'> {
  data: Omit<CommandInteractionOption, 'options'> & {
    options: T
  }
}

export type SlashSubCommand<T extends (CommandInteractionOption | undefined)[]> = Omit<
  CommandInteractionSubCommand,
  'options'
> & {
  options?: T
}

// From discord-api-types

// export enum InteractionType {
//   Ping = 1,
//   ApplicationCommand = 2,
//   MessageComponent = 3,
// }

// export enum InteractionResponseType {
//   /** ACK a `Ping` */
//   Pong = 1,
//   /** Respond to an interaction with a message */
//   ChannelMessageWithSource = 4,
//   /** ACK an interaction and edit a response later, the user sees a loading state */
//   DeferredChannelMessageWithSource = 5,
//   /** For components, ACK an interaction and edit the original message later; the user does not see a loading state */
//   DeferredUpdateMessage = 6,
//   /** For components, edit the message the component was attached to */
//   UpdateMessage = 7,
//   /** For Application Command Options, send an autocomplete result */
//   ApplicationCommandAutocompleteResult = 8,
//   /** For Command or Component interactions, send a Modal response */
//   Modal = 9,
// }

// export enum ApplicationCommandType {
//   /** A text-based command that shows up when a user types `/`
//    *
//    * aka slash command */
//   ChatInput = 1,
//   /** A UI-based command that shows up when you right click or tap on a user */
//   User = 2,
//   /** A UI-based command that shows up when you right click or tap on a message */
//   Message = 3,
// }

// export enum ApplicationCommandOptionType {
//   SubCommand = 1,
//   SubCommandGroup = 2,
//   String = 3,
//   Integer = 4,
//   Boolean = 5,
//   User = 6,
//   Channel = 7,
//   Role = 8,
//   Mentionable = 9,
//   Number = 10,
//   Attachment = 11,
// }

// export enum ButtonStyle {
//   Primary = 1,
//   Secondary = 2,
//   Success = 3,
//   Danger = 4,
//   Link = 5,
// }

// export enum MessageComponentType {
//   ActionRow = 1,
//   Button = 2,
//   SelectMenu = 3,
// }
