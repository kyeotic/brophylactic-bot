import { Command } from '../interactions.ts'
import {
  differenceInSeconds,
  MessageComponents,
  DiscordApplicationCommandOptionTypes,
  DiscordMessageComponentTypes,
  DiscordButtonStyles,
  InteractionApplicationCommandCallbackData,
  ComponentInteraction,
  SlashCommandInteraction,
  GuildMemberWithUser,
  ApplicationCommandInteractionDataOptionInteger,
  nanoid,
} from '../../deps.ts'
import { updateInteraction, asGuildMember, asContent, privateMessage, ackButton } from '../api.ts'
import { Lottery } from '../../games/lottery.ts'
import type { GuildMember, CommandResponse } from '../types.ts'
import type { AppContext } from '../../context.ts'

const lotteryTimeSeconds = 30
const lotteryTime = lotteryTimeSeconds * 1000
const updateInterval = 2500

// Poor mans cache
const lotteries = new Map<string, BrxLottery>()

const command: Command = {
  // global: true,
  guild: true,
  description: 'Starts a lottery with the server',
  options: [
    {
      name: 'bet',
      required: true,
      type: DiscordApplicationCommandOptionTypes.Integer,
      description:
        'amount of rep to bet. Cannot exceed your total rep or (playerLimit * bet) if negative',
    },
    {
      name: 'playerLimit',
      required: false,
      type: DiscordApplicationCommandOptionTypes.Integer,
      description: 'maximum number of players allowed to join negative lottery (bet * playerLimit)',
    },
  ],
  execute: async function (payload, context) {
    if (((payload as unknown) as ComponentInteraction)?.data?.customId) {
      return handleLotteryJoin(payload as ComponentInteraction, context)
    }

    payload = payload as SlashCommandInteraction

    // Validation
    //
    if (!payload.data?.options?.length || !payload.guildId)
      return asContent('missing required sub-command')

    const options = getInitialOptions(payload)
    if ('error' in options) return asContent(options.error)
    const { amount, playerLimit } = options

    if (!Number.isInteger(amount)) return asContent('amount must be an integer')

    // Init Lottery
    //
    const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)
    const memberBgr = await context.userStore.getUserRep(member)

    const { lottery, error } = BrxLottery.init({
      interaction: payload,
      context,
      creator: member,
      bet: amount,
      playerLimit,
    })
    if (!lottery || error) return asContent(error?.message ?? 'Bad request ')

    if (memberBgr < lottery.getBuyIn()) {
      return asContent(
        `${
          member.username
        } only has ${memberBgr} and cannot bet in a lottery whose buy-in is ℞${lottery.getBuyIn()}`
      )
    }

    lottery.start()

    return lotteryMessage(lottery)
  },
  // deno-lint-ignore require-await
  canHandleInteraction: async (customId: string) => {
    return lotteries.has(customId)
  },
}

interface BrxLotteryProps {
  context: AppContext
  interaction: SlashCommandInteraction
  creator: GuildMember
  bet: number
  playerLimit?: number
}

class BrxLottery extends Lottery<GuildMember> {
  static init(props: BrxLotteryProps): { lottery?: BrxLottery; error?: Error } {
    try {
      const lottery = new BrxLottery(props)
      return { lottery }
    } catch (error) {
      return { error }
    }
  }

  public readonly id: string
  private finishInterval?: number
  private updateInterval?: number
  private interaction: SlashCommandInteraction
  private context: AppContext

  private constructor({ interaction, creator, bet, playerLimit, context }: BrxLotteryProps) {
    super({ creator, bet, playerLimit })
    this.id = nanoid()
    this.interaction = interaction
    this.context = context
  }

  start(): Date {
    lotteries.set(this.id, this)

    // schedule cleanup in case of errors
    setTimeout(() => {
      lotteries.delete(this.id)
    }, lotteryTime * 2)

    this.updateInterval = setInterval(() => {
      updateInteraction({
        applicationId: this.interaction.applicationId,
        token: this.interaction.token,
        body: lotteryMessage(this),
      })
    }, updateInterval)

    this.finishInterval = setTimeout(() => this.end(), lotteryTime)

    return super.start()
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

  finish(): { winner: GuildMember; payouts: [GuildMember, number][]; isNegative: boolean } {
    throw new Error('cannot use finish on BRX lottery')
  }

  // We can't over-ride super.finish, but we need something else
  // TODO: find another way
  async end() {
    if (this.updateInterval) clearInterval(this.updateInterval)
    if (this.finishInterval) clearTimeout(this.finishInterval)
    else return

    if (!this.canFinish()) return this.finalizeInteraction('Lottery cancelled, not enough players')

    const { winner, payouts, isNegative } = super.finish()
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

    lotteries.delete(this.id)
  }
}

export default command

async function handleLotteryJoin(
  payload: ComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  // console.log('payload', payload)

  const lotteryId = payload.data?.customId
  if (!lotteryId) return ackButton()

  const lottery = lotteries.get(lotteryId)
  if (!lottery) return ackButton()

  const member = asGuildMember(payload.guildId!, payload.member!)
  const memberRep = await context.userStore.getUserRep(member)

  if (memberRep < lottery.getBuyIn()) {
    return privateMessage('You do not have enough rep')
  }

  if (!lottery.canAddPlayers) {
    return privateMessage('lottery is full')
  }

  if (lottery.getPlayers().find((p) => p.id === member.id)) {
    return privateMessage('Cannot join a lottery you are already in')
  }

  lottery.addPlayer(member)

  if (lottery.shouldFinish()) {
    lottery.end().catch((e) => console.error('lottery end error', e))
  } else {
    updateInteraction({
      applicationId: payload.applicationId,
      token: payload.token,
      body: lotteryMessage(lottery),
    })
  }

  return ackButton()
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

function lotteryMessage(lottery: BrxLottery): InteractionApplicationCommandCallbackData {
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

function getInitialOptions(
  payload: SlashCommandInteraction
): { amount: number; playerLimit: number } | { error: string } {
  const amount = (payload?.data?.options?.[0] as ApplicationCommandInteractionDataOptionInteger)
    ?.value
  const playerLimit = (payload?.data
    ?.options?.[1] as ApplicationCommandInteractionDataOptionInteger)?.value

  return { amount, playerLimit }
}
