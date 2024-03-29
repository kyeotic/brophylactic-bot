import { SardinesLottery } from './lottery'

import type { AppContext } from '../di'
import type { GuildMember } from '../discord/types'
import type { NewLotteryProps } from '../roulette/roulette'
import { bgrLabel, mention } from '../discord/api'
import config from '../config'

export interface SardinesProps {
  context: AppContext
}

/*
  A sardines game is started by a player who sets a BUY_IN, which they immediately lose;;
  they can only start one a day, and can only have one active at a time

  If nobody joins in 12 hours they can join their own game to claim the NO_ACTIVITY_PRIZE
  Every player that joins must pay the BUY_IN, which they immediately lose
  When joining a player has a chance to end the game, equal to ()


  For odds playground see:  https://codepen.io/tyrsius/pen/gOvEKjv?editors=0010
                            https://www.desmos.com/calculator/4ioz4cm8zs
*/
export const MIN_PLAYERS_BEFORE_REJOIN = config.stage === 'local' ? 1 : 4
console.log(config)

const A = 0.4
const B = 0.3
const C = 1.8

export const joinFailureChance = (n: number) => 1 - (A - n + B) / (n + C) - 1

const doesPlayerLose = (n: number): boolean => Math.random() < joinFailureChance(n)

export class Sardines {
  public readonly lottery: SardinesLottery
  private readonly context: AppContext

  static init(props: SardinesProps & NewLotteryProps): { sardines?: Sardines; error?: Error } {
    try {
      const sardines = new Sardines({
        lottery: new SardinesLottery({ ...props, players: [props.creator] }),
        ...props,
      })
      return { sardines }
    } catch (error) {
      return { error }
    }
  }

  static async load(
    id: string,
    props: SardinesProps
  ): Promise<{ sardines?: Sardines; error?: Error }> {
    try {
      const lottery = await props.context.sardinesStore.get(id)
      if (!lottery) throw new Error('Sardines Lottery not found')
      return { sardines: new Sardines({ lottery, ...props }) }
    } catch (error) {
      return { error }
    }
  }

  private constructor({ context, lottery }: SardinesProps & { lottery: SardinesLottery }) {
    this.lottery = lottery
    this.context = context
  }

  async start(): Promise<Date> {
    this.lottery.start()

    await this.context.sardinesStore.put(this.lottery)
    // Immediately dock buy-in
    await this.context.userStore.incrementUserRep(this.lottery.creator, this.lottery.buyIn * -1)

    // We called start() above, this can't be empty
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.lottery.startTime!
  }

  getStart(): Date | undefined {
    return this.lottery.startTime
  }

  get id(): string {
    return this.lottery.id
  }

  get buyIn(): number {
    return this.lottery.buyIn
  }

  getBet(): number {
    return this.lottery.bet
  }

  getCreator(): GuildMember {
    return this.lottery.creator
  }

  getPlayers(): GuildMember[] {
    return this.lottery.players
  }

  canJoinRepeat(): boolean {
    return this.lottery.players.length >= MIN_PLAYERS_BEFORE_REJOIN
  }

  canAddPlayer(): boolean {
    // Length is all players, but joiners should not count the creator
    // So do not add one to check the incoming player, just leave it at length
    const didLose = doesPlayerLose(this.lottery.players.length)
    return !didLose
    // return doesPlayerLose(this.lottery.players.length + 1)
  }

  async addPlayer(player: GuildMember): Promise<void> {
    this.lottery.addPlayer(player)
    await this.context.sardinesStore.setPlayers(this.lottery.id, this.lottery.players)
    // Immediately dock buy-in
    await this.context.userStore.incrementUserRep(player, this.lottery.buyIn * -1)
  }

  async finish(loser: GuildMember): Promise<string> {
    const bettors = this.lottery.players.map((player) => player.username).concat(loser.username)
    const { winner, payouts } = this.lottery.finish()
    payouts.push([loser, this.lottery.buyIn * -1])

    const names = [...new Set([...bettors]).values()].map((name) => {
      const count = bettors.filter((p) => p === name).length
      return count > 1 ? `${name} (x${count})` : name
    })

    await this.context.userStore.incrementUserReps(
      ...payouts.map(([member, offset]) => ({ member, offset }))
    )

    await this.context.sardinesStore.delete(this.lottery.id)

    // TODO get all new rep values and include in message
    return `The sardines game started by ${this.lottery.creator.username} was ended by ${
      loser.username
    } failing to join. They were still charged.\n${mention(winner)} won ${bgrLabel(
      this.lottery.getPayout()
    )} with a payout multiplier of **${(this.lottery.multiplier * 100).toPrecision(
      3
    )}%**.\n\n${names.join(', ')} all bet ${bgrLabel(this.getBet())} for a total pot of ${bgrLabel(
      this.lottery.potSize.toString()
    )}.`
  }
}
