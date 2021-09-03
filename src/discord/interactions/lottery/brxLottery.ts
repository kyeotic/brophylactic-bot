import {
  SlashCommandInteraction,
  DiscordMessageComponentTypes,
  DiscordButtonStyles,
  MessageComponents,
  differenceInSeconds,
  InteractionApplicationCommandCallbackData,
  nanoid,
} from '../../../deps.ts'
import { updateInteraction } from '../../api.ts'
import { Lottery } from '../../../games/lottery.ts'
import type { GuildMember } from '../../types.ts'
import type { AppContext } from '../../../context.ts'

const lotteryTimeSeconds = 30
export const lotteryTime = lotteryTimeSeconds * 1000
const updateInterval = 2500

export interface BrxLotteryProps {
  context: AppContext
  interaction: SlashCommandInteraction
  creator: GuildMember
  bet: number
  playerLimit?: number
}

export class BrxLottery {
  static init(props: BrxLotteryProps): { lottery?: BrxLottery; error?: Error } {
    try {
      const lottery = new BrxLottery(props)
      return { lottery }
    } catch (error) {
      return { error }
    }
  }

  public readonly lottery: Lottery<GuildMember>
  public readonly id: string
  private finishInterval?: number
  private updateInterval?: number
  private interaction: SlashCommandInteraction
  private context: AppContext

  private constructor({ interaction, creator, bet, playerLimit, context }: BrxLotteryProps) {
    this.lottery = new Lottery<GuildMember>({ creator, bet, playerLimit })
    this.id = nanoid()
    this.interaction = interaction
    this.context = context
  }

  async start(): Promise<Date> {
    await this.context.lotteryCache.set(this.id, this)

    // schedule cleanup in case of errors
    setTimeout(() => {
      this.context.lotteryCache.delete(this.id)
    }, lotteryTime * 2)

    this.updateInterval = setInterval(() => {
      updateInteraction({
        applicationId: this.interaction.applicationId,
        token: this.interaction.token,
        body: lotteryMessage(this),
      })
    }, updateInterval)

    this.finishInterval = setTimeout(() => this.finish(), lotteryTime)

    return this.lottery.start()
  }

  getStart(): Date {
    return this.lottery.getStart()
  }

  getBuyIn(): number {
    return this.lottery.getBuyIn()
  }

  getBet(): number {
    return this.lottery.getBet()
  }

  getPotSize(): number {
    return this.lottery.getPotSize()
  }

  get playerLimit(): number | undefined {
    return this.lottery.playerLimit
  }

  getCreator(): GuildMember {
    return this.lottery.getCreator()
  }

  canAddPlayers(): boolean {
    return this.lottery.canAddPlayers()
  }

  getPlayers(): GuildMember[] {
    return this.lottery.getPlayers()
  }

  addPlayer(player: GuildMember): void {
    return this.lottery.addPlayer(player)
  }

  get isNegative(): boolean {
    return this.lottery.isNegative
  }

  finalizeInteraction(message: string): void {
    updateInteraction({
      applicationId: this.interaction.applicationId,
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
    if (this.updateInterval) clearInterval(this.updateInterval)
    if (this.finishInterval) clearTimeout(this.finishInterval)
    else return

    if (!this.lottery.canFinish())
      return this.finalizeInteraction('Lottery cancelled, not enough players')

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
        } lost ℞${this.getPotSize()}`
      )
    } else {
      this.finalizeInteraction(
        `The lottery has ended. ${names.join(', ')} all bet ℞${this.getBet()}. ${
          winner.username
        } won ℞${this.getPotSize()}`
      )
    }

    await this.context.lotteryCache.delete(this.id)
  }
}

export function lotteryMessage(lottery: BrxLottery): InteractionApplicationCommandCallbackData {
  const timeRemaining = differenceInSeconds(lottery.getStart().getTime() + lotteryTime, new Date())
  const creatorName = lottery.getCreator().username
  const players = lottery.getPlayers()

  const banner = lottery.isNegative
    ? `${creatorName} has started a negative lottery for ℞${lottery.getBet()} for up to ${
        lottery.playerLimit
      } players. Click the button below within ${timeRemaining} seconds to place join the lottery. The loser will pay all other players ℞${lottery.getBet()} for a maximum loss of ℞${lottery.getBuyIn()}`
    : `${creatorName} has started a lottery for ℞${lottery.getBet()}. Click the button below within ${timeRemaining} seconds to place an equal bet and join the lottery.`

  const footer =
    players.length < 2 ? '' : `\n**Players**\n${players.map((p) => p.username).join('\n')}`

  return {
    content: banner + footer,
    components: lottery.canAddPlayers() ? joinLotteryComponents(lottery.id) : [],
  }
}

function joinLotteryComponents(id: string): MessageComponents {
  return [
    {
      type: DiscordMessageComponentTypes.ActionRow,
      components: [
        {
          type: DiscordMessageComponentTypes.Button,
          label: 'Join Lottery',
          style: DiscordButtonStyles.Primary,
          customId: id,
        },
      ],
    },
  ]
}
