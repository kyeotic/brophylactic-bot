import { nanoid } from 'nanoid'
import { randomInclusive } from '../util/random.js'

export interface LotteryProps<Player> {
  id?: string
  creator: Player
  bet: number
  playerLimit?: number
  players?: Player[]
  startTime?: Date
}

export class Lottery<Player> {
  public readonly id: string
  public readonly isNegative: boolean
  public readonly bet: number
  public readonly playerLimit?: number
  public readonly creator: Player
  private _players: Set<Player>
  private _startTime?: Date

  constructor({ id, creator, bet, playerLimit, players, startTime }: LotteryProps<Player>) {
    if (bet === 0) {
      throw new Error('bet cannot be 0')
    }
    if (!Number.isInteger(bet) || Number.isNaN(bet)) {
      throw new Error('bet must be an integer')
    }

    this.id = id ?? nanoid()
    this.bet = bet
    this.isNegative = bet < 0

    if (this.isNegative && !playerLimit) {
      throw new Error('"playerLimit" is required when bet is negative')
    }
    if (playerLimit && (!Number.isInteger(playerLimit) || playerLimit < 2)) {
      throw new Error('"playerLimit" must be an integer of at least 2')
    }

    if (this.isNegative) {
      this.playerLimit = playerLimit
    }

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
    return this.isNegative ? getPayout(this.bet, this.playerLimit!) : this.bet
  }

  get potSize(): number {
    // The pot size is the amount of the win, while the payout doesn't include the buy-in
    // since the offset returned must account for the player not having actually lost the rep yet
    // So we add a virtual player to make the pot size show the full pot for positive lotteries
    return getPayout(this.bet, this._players.size + (this.isNegative ? 0 : 1))
  }

  get players(): Player[] {
    return [...this._players.values()]
  }

  start(): Date {
    if (this._startTime) return this._startTime
    this._startTime = new Date()
    return this._startTime
  }

  canAddPlayers(): boolean {
    return this.playerLimit === undefined || this._players.size < this.playerLimit
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

  shouldFinish(): boolean {
    return !!this.playerLimit && this.playerLimit == this._players.size
  }

  /** End the lottery and get an array of players and payout amounts. Negative payouts indicate loss */
  finish(): { winner: Player; payouts: [Player, number][]; isNegative: boolean } {
    const players = Array.from(this._players.values())
    const winner = players[randomInclusive(0, this._players.size - 1)]

    // In a negative lottery the "winner" pays the pot to the losers
    const winnerMod = this.isNegative ? -1 : 1
    // In a negative lottery the "losers" receive the bet from the winner
    const loserMod = this.isNegative ? 1 : -1

    const payouts = players.map<[Player, number]>((player) => [
      player,
      // If the player is the loser they lose the pot size
      // otherwise the player receives the bet
      player === winner ? getPayout(this.bet, this._players.size) * winnerMod : this.bet * loserMod,
    ])

    if (!winner) {
      console.log('debug', winner, players)
    }

    return { winner, payouts, isNegative: this.isNegative }
  }

  toJSON() {
    return {
      id: this.id,
      creator: this.creator,
      bet: this.bet,
      playerLimit: this.playerLimit,
      players: this.players,
      startTime: this._startTime,
    }
  }
}

function getPayout(bet: number, players: number) {
  // For negative lotteries the loser pays everyone ELSE
  // For positive lotteries everyone pays the WINNER
  // either way the pot excludes one person
  return Math.abs(bet) * (players - 1)
}
