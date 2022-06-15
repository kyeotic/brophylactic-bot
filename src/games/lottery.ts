import { nanoid } from 'nanoid'
import { randomInclusive } from '../util/random'

export interface LotteryProps<Player> {
  id?: string
  creator: Player
  bet: number
  players?: Player[]
  startTime?: Date
}

export class Lottery<Player> {
  public readonly id: string
  public readonly bet: number
  public readonly creator: Player
  private _players: Set<Player>
  private _startTime?: Date

  constructor({ id, creator, bet, players, startTime }: LotteryProps<Player>) {
    if (bet <= 0) {
      throw new Error('bet cannot be less than or equal to 0')
    }
    if (!Number.isInteger(bet) || Number.isNaN(bet)) {
      throw new Error('bet must be an integer')
    }

    this.id = id ?? nanoid()
    this.bet = bet

    this.creator = creator
    this._players = new Set<Player>()
    if (players) {
      players.forEach((p) => this.addPlayer(p))
    }
    if (startTime) {
      this._startTime = startTime
    }
  }

  get startTime(): Date | undefined {
    return this._startTime
  }

  get buyIn(): number {
    return this.bet
  }

  get potSize(): number {
    // The pot size is the amount of the win, while the payout doesn't include the buy-in
    // since the offset returned must account for the player not having actually lost the rep yet
    // So unlike the payout it includes the bet times all players
    return this.bet * this._players.size
  }

  get players(): Player[] {
    return [...this._players.values()]
  }

  start(): Date {
    if (this._startTime) return this._startTime
    this._startTime = new Date()
    return this._startTime
  }

  addPlayer(player: Player): void {
    this._players.add(player)
  }

  removePlayer(player: Player): void {
    this._players.delete(player)
  }

  canFinish(): boolean {
    return this._players.size > 1
  }

  /** End the lottery and get an array of players and payout amounts. Negative payouts indicate loss */
  finish(): { winner: Player; payouts: [Player, number][] } {
    const players = Array.from(this._players.values())
    const winner = players[randomInclusive(0, this._players.size - 1)]

    const payouts = players.map<[Player, number]>((player) => [
      player,
      // If the player is the loser they lose the pot size
      // otherwise the player receives the bet
      player === winner ? this.getPayout() : this.bet,
    ])

    if (!winner) {
      console.log('debug', winner, players)
    }

    return { winner, payouts }
  }

  getPayout() {
    // In a lottery everyone pays the winner, but the winner does not pay themself
    // Since money is not collected unless it is lost
    return Math.abs(this.bet) * (this._players.size - 1)
  }

  toJSON() {
    return {
      id: this.id,
      creator: this.creator,
      bet: this.bet,
      players: this.players,
      startTime: this._startTime,
    }
  }
}
