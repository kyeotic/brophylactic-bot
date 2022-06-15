import { Lottery } from './lottery'

import type { AppContext } from '../di'
import type { GuildLottery } from './store'
import type { GuildMember, Interaction } from '../discord/types'

export const lotteryTimeSeconds = 30
// export const lotteryTimeSeconds = 5 // debug
export const lotteryTimeMs = lotteryTimeSeconds * 1000
// const updateInterval =

export interface BrxLotteryProps {
  context: AppContext
  interaction: Interaction
}

export interface NewLotteryProps {
  creator: GuildMember
  bet: number
  playerLimit?: number
}

export class BrxLottery {
  static init(props: BrxLotteryProps & NewLotteryProps): { lottery?: BrxLottery; error?: Error } {
    try {
      const lottery = new BrxLottery({
        lottery: new Lottery({ ...props, players: [props.creator] }),
        ...props,
      })
      return { lottery }
    } catch (error) {
      return { error }
    }
  }

  static async load(
    id: string,
    props: BrxLotteryProps
  ): Promise<{ lottery?: BrxLottery; error?: Error }> {
    try {
      const lottery = await props.context.lotteryStore.get(id)
      if (!lottery) throw new Error('Lottery not found')
      return { lottery: new BrxLottery({ lottery, ...props }) }
    } catch (error) {
      return { error }
    }
  }

  public readonly lottery: GuildLottery
  private interaction: Interaction
  private context: AppContext

  private constructor({
    interaction,
    context,
    lottery,
  }: BrxLotteryProps & { lottery: GuildLottery }) {
    this.lottery = lottery
    this.interaction = interaction
    this.context = context
  }

  async start(): Promise<Date> {
    this.lottery.start()

    await this.context.lotteryStore.put(this.lottery)

    await this.context.workflow.startLottery({
      id: this.lottery.id,
      interaction: this.interaction,
      duration: lotteryTimeSeconds,
    })

    // await this.finish()

    // We called start() above, this can't be empty
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

  get playerLimit(): number | undefined {
    return this.lottery.playerLimit
  }

  getCreator(): GuildMember {
    return this.lottery.creator
  }

  canAddPlayers(): boolean {
    return this.lottery.canAddPlayers()
  }

  getPlayers(): GuildMember[] {
    return this.lottery.players
  }

  async addPlayer(player: GuildMember): Promise<void> {
    this.lottery.addPlayer(player)
    await this.context.lotteryStore.setPlayers(this.lottery.id, this.lottery.players)
  }

  get isNegative(): boolean {
    return this.lottery.isNegative
  }

  async finalizeInteraction(message: string): Promise<void> {
    await this.context.discord.updateInteraction({
      applicationId: this.interaction.application_id,
      token: this.interaction.token,
      body: {
        content: message,
        components: [],
      },
    })
  }

  shouldFinish(): boolean {
    return this.lottery.shouldFinish()
  }

  async finish() {
    if (!this.lottery.canFinish())
      return this.finalizeInteraction(
        `${this.lottery.creator.username}'s Lottery cancelled, not enough players joined.`
      )

    const { winner, payouts, isNegative } = this.lottery.finish()
    const names = payouts.map(([player]) => player.username)

    await this.context.userStore.incrementUserReps(
      ...payouts.map(([member, offset]) => ({ member, offset }))
    )

    // TODO get all new rep values and include in message
    if (isNegative) {
      this.finalizeInteraction(
        `The lottery has ended. ${names.join(', ')} all bet ℞${Math.abs(this.getBet())}. ${
          winner.username
        } lost ℞${this.lottery.potSize}`
      )
    } else {
      this.finalizeInteraction(
        `The lottery has ended. ${names.join(', ')} all bet ℞${this.getBet()}. ${
          winner.username
        } won ℞${this.lottery.potSize}`
      )
    }

    await this.context.lotteryStore.delete(this.lottery.id)
  }
}
