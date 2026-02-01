import { Lottery } from '../games/lottery'

import type { AppContext } from '../di'
import type { RouletteLottery } from './store'
import type { GuildMember, Interaction } from '../discord/types'
import { bgrLabel } from '../discord/api'

export const rouletteTimeSeconds = 30
// export const rouletteTimeSeconds = 5 // debug
export const rouletteTimeMs = rouletteTimeSeconds * 1000
// const updateInterval =

export interface RouletteProps {
  context: AppContext
}

export interface NewLotteryProps {
  creator: GuildMember
  bet: number
}

export class Roulette {
  public readonly lottery: RouletteLottery
  private readonly context: AppContext

  static init(props: RouletteProps & NewLotteryProps): { roulette?: Roulette; error?: Error } {
    try {
      const roulette = new Roulette({
        lottery: new Lottery({ ...props, players: [props.creator] }),
        ...props,
      })
      return { roulette }
    } catch (error) {
      return { error }
    }
  }

  static async load(
    id: string,
    props: RouletteProps
  ): Promise<{ roulette?: Roulette; error?: Error }> {
    try {
      const lottery = await props.context.rouletteStore.get(id)
      if (!lottery) throw new Error('Roulette Lottery not found')
      return { roulette: new Roulette({ lottery, ...props }) }
    } catch (error) {
      return { error }
    }
  }

  private constructor({ context, lottery }: RouletteProps & { lottery: RouletteLottery }) {
    this.lottery = lottery
    this.context = context
  }

  async start(interaction: Interaction): Promise<Date> {
    this.lottery.start()

    await this.context.rouletteStore.put(this.lottery)

    await this.context.jobQueue.enqueue(
      'roulette:finish',
      { id: this.lottery.id, interaction },
      rouletteTimeSeconds
    )

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

  async addPlayer(player: GuildMember): Promise<void> {
    this.lottery.addPlayer(player)
    await this.context.rouletteStore.setPlayers(this.lottery.id, this.lottery.players)
  }

  async finish(): Promise<string> {
    if (!this.lottery.canFinish()) {
      return `${this.lottery.creator.username}'s roulette game was cancelled, not enough players joined.`
    }

    const { winner, payouts } = this.lottery.finish()
    const names = payouts.map(([player]) => player.username)

    await this.context.userStore.incrementUserReps(
      ...payouts.map(([member, offset]) => ({ member, offset }))
    )

    await this.context.rouletteStore.delete(this.lottery.id)

    // TODO get all new rep values and include in message
    return `The roulette game has ended. ${names.join(', ')} all bet ${bgrLabel(this.getBet())}. ${
      winner.username
    } won ${bgrLabel(this.lottery.potSize)}`
  }
}
