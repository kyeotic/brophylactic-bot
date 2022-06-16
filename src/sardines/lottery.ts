import { Lottery } from '../games/lottery'
import { weightedRandom } from '../util/random'
import type { GuildMember } from '../discord/types'

const payouts = [1.2, 1.5, 1.8, 2.0, 2.5]

export class SardinesLottery extends Lottery<GuildMember> {
  // In a sardines lottery the only payout is to the winner
  override finish(): { winner: GuildMember; payouts: [GuildMember, number][] } {
    const result = super.finish()
    const winner = result.winner
    const payouts = result.payouts.filter(([player]) => player === winner)

    return { winner, payouts }
  }

  get multiplier(): number {
    return payouts[weightedRandom(1, payouts.length, this.id) - 1]
  }

  get potSize(): number {
    // For sardines the pot size includes the loser, but the players does not
    return this.bet * (this._players.length + 1)
  }

  override getPayout() {
    // In a sardines lottery the winner gets
    // POT * PLAYER_SIZE * MULTIPLIER
    return Math.floor(this.potSize * this.multiplier)
  }
}
