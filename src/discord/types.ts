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
import type { AppContext } from '../context.ts'
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
export interface GuildMember extends DiscordGuildMember {
  id: string
  guildId: string
  username: string
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
  canHandleInteraction?: (customId: string, context: AppContext) => Promise<boolean>
}

export function isInteractionResponse(
  response: InteractionResponse | InteractionApplicationCommandCallbackData
): response is InteractionResponse {
  return Reflect.has(response, 'type')
}

export interface SlashSubCommand<T extends (ApplicationCommandInteractionDataOption | undefined)[]>
  extends Omit<ApplicationCommandInteractionDataOptionSubCommand, 'options'> {
  options: T
}

export interface SlashCommand<T extends (ApplicationCommandInteractionDataOption | undefined)[]>
  extends Omit<SlashCommandInteraction, 'data'> {
  data: Omit<ApplicationCommandInteractionData, 'options'> & {
    options: T
  }
}
