import type { GuildMember } from '../discord/types'

export interface DbRouletteLottery {
  id: string
  creator: GuildMember
  bet: number
  players: GuildMember[]
  winner?: GuildMember
  startTime: Date
}
