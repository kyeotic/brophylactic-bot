import { Command } from './mod.ts'
import {
  formatDistanceToNow,
  isSameDay,
  startOfDay,
  differenceInSeconds,
  MessageComponents,
  DiscordApplicationCommandOptionTypes,
  DiscordMessageComponentTypes,
  DiscordInteractionResponseTypes,
  DiscordButtonStyles,
  DiscordButtonComponent,
  InteractionResponse,
  InteractionApplicationCommandCallbackData,
  ComponentInteraction,
  SlashCommandInteraction,
  GuildMemberWithUser,
  ApplicationCommandInteractionDataOptionInteger,
  nanoid,
} from '../../deps.ts'
import {
  updateInteraction,
  getGuildMember,
  asGuildMember,
  asContent,
  privateMessage,
  ackButton,
} from '../api.ts'
import { getMemberName } from '../../users/store.ts'
import { seededRandomRange } from '../../util/random.ts'
import { Lottery } from '../../games/lottery.ts'
import type { GuildMember, CommandResponse } from '../types.ts'
import type { AppContext } from '../../context.ts'

const lotteryTimeSeconds = 30
const updateInterval = 5000

const lotteries = new Map<string, Lottery<GuildMember>>()

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

    if (!payload.data?.options?.length || !payload.guildId)
      return asContent('missing required sub-command')

    const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)
    const memberName = getMemberName(member)
    const memberBgr = await context.userStore.getUserRep(member)

    const amount = (payload.data?.options[0] as ApplicationCommandInteractionDataOptionInteger)
      ?.value
    const playerLimit = (payload.data?.options[1] as ApplicationCommandInteractionDataOptionInteger)
      ?.value

    if (!Number.isInteger(amount)) return asContent('amount must be an integer')

    let lottery: Lottery<GuildMember>
    const lotteryId = nanoid()

    try {
      lottery = new Lottery<GuildMember>({ creator: member, bet: amount, playerLimit })
    } catch (e) {
      return asContent(e.message)
    }

    if (memberBgr < lottery.getBuyIn()) {
      return asContent(
        `${memberName} only has ${memberBgr} and cannot bet in a lottery whose buyin is ℞${lottery.getBuyIn()}`
      )
    }

    lotteries.set(lotteryId, lottery)
    // schedule cleanup in case of errors
    setTimeout(() => {
      lotteries.delete(lotteryId)
    }, lotteryTimeSeconds * 2 * 1000)

    const update = async () =>
      updateInteraction({
        applicationId: payload.applicationId,
        token: payload.token,
        body: lotteryMessage(lotteryId, lottery),
      })

    const finish = async (message: string) =>
      updateInteraction({
        applicationId: payload.applicationId,
        token: payload.token,
        body: {
          content: message,
          components: [],
        },
      })

    const startTime = lottery.start()

    const updateTime = setInterval(() => {
      update()
    }, updateInterval)

    setTimeout(async () => {
      clearInterval(updateTime)
      if (!lottery.canFinish()) return finish('Lottery cancelled, not enough players')

      const { winner, payouts, isNegative } = lottery.finish()
      const names = payouts.map(([player]) => getMemberName(player))

      await context.userStore.incrementUserReps(
        ...payouts.map(([member, offset]) => ({ member, offset }))
      )

      // TODO get all new rep values and include in message
      if (isNegative) {
        finish(
          `The lottery has ended. ${names.join(', ')} all bet ℞${Math.abs(amount)}. ${getMemberName(
            winner
          )} lost ℞${lottery.getPotSize()}`
        )
      } else {
        finish(
          `The lottery has ended. ${names.join(', ')} all bet ℞${amount}. ${getMemberName(
            winner
          )} won ℞${lottery.getPotSize()}`
        )
      }

      lotteries.delete(lotteryId)
    }, lotteryTimeSeconds * 1000)

    console.log('lottery', lotteryId)

    return lotteryMessage(lotteryId, lottery)
  },
  canHandleInteraction: async (customId: string) => {
    return lotteries.has(customId)
  },
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

  updateInteraction({
    applicationId: payload.applicationId,
    token: payload.token,
    body: lotteryMessage(lotteryId, lottery),
  })

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

function lotteryMessage(
  lotteryId: string,
  lottery: Lottery<GuildMember>
): InteractionApplicationCommandCallbackData {
  const timeRemaining = differenceInSeconds(
    lottery.start().getTime() + lotteryTimeSeconds * 1000,
    new Date()
  )
  const creatorName = getMemberName(lottery.getCreator())
  const players = lottery.getPlayers()

  const banner = lottery.isNegative
    ? `${creatorName} has started a negative lottery for ℞${lottery.getBet()} for up to ${
        lottery.playerLimit
      } players. Click the button below within ${timeRemaining} seconds to place join the lottery. The loser will pay all other players ℞${lottery.getBet()} for a maximum loss of ℞${lottery.getBuyIn()}`
    : `${creatorName} has started a lottery for ℞${lottery.getBet()}. Click the button below within ${timeRemaining} seconds to place an equal bet and join the lottery.`

  const footer =
    players.length < 2 ? '' : `\n**Players**\n${players.map((p) => getMemberName(p)).join('\n')}`

  return {
    content: banner + footer,
    components: lottery.canAddPlayers() ? joinLotteryComponents(lotteryId) : [],
  }
}
