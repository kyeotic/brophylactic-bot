import { randomInclusive } from '../util/random.ts'

export class Lottery<T> {
  private isNegativeLottery: boolean
  private bet: number
  private playerLimit?: number
  private players: Set<T>

  constructor({ bet, playerLimit }: { bet: number; playerLimit?: number }) {
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
    if (this.isNegativeLottery) {
      this.playerLimit = playerLimit
    }
    this.players = new Set<T>()
  }

  canAddPlayers(): boolean {
    return this.playerLimit === undefined || this.players.size < this.playerLimit
  }

  addPlayer(player: T): void {
    this.players.add(player)
  }

  removePlayer(player: T): void {
    this.players.delete(player)
  }

  /** End the lottery and get an array of players and payout amounts. Negative payouts indicate loss */
  finish(): [T, number][] {
    const players = Array.from(this.players.values())
    const winner = players[randomInclusive(0, this.players.size)]

    // In a negative lottery the "winner" pays the pot to the losers
    const winnerMod = this.isNegativeLottery ? -1 : 1
    // In a negative lottery the "losers" receive the bet from the winner
    const loserMod = this.isNegativeLottery ? 1 : -1

    return players.map((player) => [
      player,
      // If the player is the loser they lose the pot size
      // otherwise the player receives the bet
      player === winner ? getPotSize(this.bet, this.players.size) * winnerMod : this.bet * loserMod,
    ])
  }
}

function getPotSize(bet: number, players: number) {
  // For negative lotteries the loser pays everyone ELSE
  // For positive lotteries everyone pays the WINNER
  // either way the pot excludes one person
  return Math.abs(bet) * (players - 1)
}
