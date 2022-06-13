import type { GuildMember } from '../discord/types.js'

export interface DbLottery {
  id: string
  creator: GuildMember
  bet: number
  playerLimit?: number
  players: GuildMember[]
  winner?: GuildMember
  startTime: Date
}
