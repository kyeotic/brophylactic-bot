import { randomInclusive } from '../util/random.ts'

export interface LotteryProps<T> {
  creator: T
  bet: number
  playerLimit?: number
}

export class Lottery<T> {
  private isNegativeLottery: boolean
  private bet: number
  private _playerLimit?: number
  private players: Set<T>
  private creator: T
  private startTime?: Date

  constructor({ creator, bet, playerLimit }: LotteryProps<T>) {
    if (bet === 0) {
      throw new Error('bet cannot be 0')
    }
    if (!Number.isInteger(bet) || Number.isNaN(bet)) {
      throw new Error('bet must be an integer')
    }
    this.bet = bet
    this.isNegativeLottery = bet < 0

    if (this.isNegativeLottery && !playerLimit) {
      throw new Error('"playerLimit" is required when bet is negative')
    }
    if (playerLimit && (!Number.isInteger(playerLimit) || playerLimit < 2)) {
      throw new Error('"playerLimit" must be an integer of at least 2')
    }

    if (this.isNegativeLottery) {
      this._playerLimit = playerLimit
    }

    this.creator = creator
    this.players = new Set<T>()
    this.addPlayer(creator)
  }

  start(): Date {
    if (this.startTime) return this.startTime
    this.startTime = new Date()
    return this.startTime
  }

  getStart(): Date {
    return this.startTime ?? new Date()
  }

  canAddPlayers(): boolean {
    return this._playerLimit === undefined || this.players.size < this._playerLimit
  }

  addPlayer(player: T): void {
    this.players.add(player)
  }

  removePlayer(player: T): void {
    this.players.delete(player)
  }

  getBet(): number {
    return this.bet
  }

  getBuyIn(): number {
    return this.isNegativeLottery ? getPayout(this.bet, this._playerLimit!) : this.bet
  }

  getPotSize(): number {
    // The pot size is the amount of the win, while the payout doesn't include the buy-in
    // since the offset returned must account for the player not having actually lost the rep yet
    // So we add a virtual player to make the pot size show the full pot for positive lotteries
    return getPayout(this.bet, this.players.size + (this.isNegative ? 0 : 1))
  }

  getCreator(): T {
    return this.creator
  }

  getPlayers(): T[] {
    return [...this.players.values()]
  }

  get isNegative(): boolean {
    return this.isNegativeLottery
  }

  get playerLimit(): number | undefined {
    return this._playerLimit
  }

  canFinish(): boolean {
    return this.players.size > 1
  }

  shouldFinish(): boolean {
    return !!this.playerLimit && this.playerLimit == this.players.size
  }

  /** End the lottery and get an array of players and payout amounts. Negative payouts indicate loss */
  finish(): { winner: T; payouts: [T, number][]; isNegative: boolean } {
    const players = Array.from(this.players.values())
    const winner = players[randomInclusive(0, this.players.size - 1)]

    // In a negative lottery the "winner" pays the pot to the losers
    const winnerMod = this.isNegativeLottery ? -1 : 1
    // In a negative lottery the "losers" receive the bet from the winner
    const loserMod = this.isNegativeLottery ? 1 : -1

    const payouts = players.map<[T, number]>((player) => [
      player,
      // If the player is the loser they lose the pot size
      // otherwise the player receives the bet
      player === winner ? getPayout(this.bet, this.players.size) * winnerMod : this.bet * loserMod,
    ])

    if (!winner) {
      console.log('debug', winner, players)
    }

    return { winner, payouts, isNegative: this.isNegative }
  }
}

function getPayout(bet: number, players: number) {
  // For negative lotteries the loser pays everyone ELSE
  // For positive lotteries everyone pays the WINNER
  // either way the pot excludes one person
  return Math.abs(bet) * (players - 1)
}
