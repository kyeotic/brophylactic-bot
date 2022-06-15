import type { GuildMember } from '../discord/types'

export interface DbSardinesLottery {
  id: string
  creator: GuildMember
  bet: number
  players: GuildMember[]
  winner?: GuildMember
  startTime: Date
}
