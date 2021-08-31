import { GuildMember as DiscordGuildMember } from '../deps.ts'

export type { DiscordGuildMember }

/** App-extended type for Guild Members with non-optional ids*/
export interface GuildMember extends DiscordGuildMember {
  id: string
  guildId: string
}
