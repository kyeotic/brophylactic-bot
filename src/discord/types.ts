import {
  GuildMember as DiscordGuildMember,
  InteractionApplicationCommandCallbackData,
  InteractionResponse,
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
