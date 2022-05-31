import {
  GuildMember as DiscordGuildMember,
  InteractionApplicationCommandCallbackData,
  ApplicationCommandOption,
  Interaction,
  InteractionResponse,
  SlashCommandInteraction,
  ApplicationCommandInteractionData,
  ApplicationCommandInteractionDataOptionSubCommand,
  ApplicationCommandInteractionDataOption,
} from '../deps.ts'
import type { AppContext } from '../di.ts'

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
} from '../deps.ts'

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

// from Discord-Deno

export interface ApplicationCommandOption {
  /** Value of Application Command Option Type */
  type: ApplicationCommandOptionTypes
  /** 1-32 character name matching lowercase `^[\w-]{1,32}$` */
  name: string
  /** Localization object for the `name` field. Values follow the same restrictions as `name` */
  nameLocalizations?: Localization
  /** 1-100 character description */
  description: string
  /** Localization object for the `description` field. Values follow the same restrictions as `description` */
  descriptionLocalizations?: Localization
  /** If the parameter is required or optional--default `false` */
  required?: boolean
  /** Choices for `string` and `int` types for the user to pick from */
  choices?: ApplicationCommandOptionChoice[]
  /** If the option is a subcommand or subcommand group type, this nested options will be the parameters */
  options?: ApplicationCommandOption[]
  /** if autocomplete interactions are enabled for this `String`, `Integer`, or `Number` type option */
  autocomplete?: boolean
  /** If the option is a channel type, the channels shown will be restricted to these types */
  channelTypes?: ChannelTypes[]
  /** Minimum number desired. */
  minValue?: number
  /** Maximum number desired. */
  maxValue?: number
}
