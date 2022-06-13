import { updateInteraction, asGuildMember, message, encodeCustomId } from '../discord/api'
import { differenceInSeconds } from '../util/dates'
import { lotteryTimeMs } from './brxLottery'

import {
  ButtonStyle,
  ComponentType,
  ApplicationCommandOptionType,
  InteractionResponseType,
} from '../discord/types'

import type {
  Interaction,
  MessageComponentInteraction,
  DiscordGuildMemberWithUser,
  MessageComponents,
  CommandResponse,
  MessageResponse,
  Command,
  SlashCommand,
  CommandInteractionInteger,
} from '../discord/types'

import type { AppContext } from '../di'
import type { BrxLottery } from './brxLottery'

export type LotteryInteraction = SlashCommand<
  [CommandInteractionInteger, CommandInteractionInteger | undefined]
>

export const ID_TYPE = 'LOTTERY'

const command: Command<LotteryInteraction> = {
  // global: true,
  guild: true,
  description: 'Starts a lottery with the server',
  options: [
    {
      name: 'bet',
      required: true,
      type: ApplicationCommandOptionType.Integer,
      description:
        'amount of rep to bet. Cannot exceed your total rep or (playerLimit * bet) if negative',
    },
    {
      name: 'playerLimit',
      required: false,
      type: ApplicationCommandOptionType.Integer,
      description: 'maximum number of players allowed to join negative lottery (bet * playerLimit)',
    },
  ],
  execute: async function (
    payload: LotteryInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    if ((payload as unknown as MessageComponentInteraction)?.data?.custom_id) {
      return handleLotteryJoin(payload as unknown as MessageComponentInteraction, context)
    }

    return await handleLottery(payload as LotteryInteraction, context)
  },
  messageInteractionType: ID_TYPE,
}

export default command

async function handleLottery(
  payload: LotteryInteraction,
  context: AppContext
): Promise<CommandResponse> {
  // Validation
  //
  if (!payload.data?.options?.length || !payload.guild_id)
    return message('missing required sub-command')

  // const options = getInitialOptions(payload)
  // if ('error' in options) return message(options.error)
  // const { amount, playerLimit } = options

  const amount = payload.data.options[0].value
  const playerLimit = payload.data.options[1]?.value

  if (!Number.isInteger(amount)) return message('amount must be an integer')

  // Init Lottery
  //
  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)
  // console.log('creator member', JSON.stringify(member, null, 2))
  // if (parseFloat(member.id) > 0) {
  //   throw new Error('exit')
  // }
  const memberBgr = await context.userStore.getUserRep(member)

  const { lottery, error } = context.lottery.init({
    interaction: payload as unknown as Interaction,
    creator: member,
    bet: amount,
    playerLimit,
  })
  if (!lottery || error) return message(error?.message ?? 'Bad request ')

  if (memberBgr < lottery.buyIn) {
    return message(
      `${member.username} only has ${memberBgr} and cannot bet in a lottery whose buy-in is ℞${lottery.buyIn}`
    )
  }

  await lottery.start()

  return lotteryMessage(lottery)
}

async function handleLotteryJoin(
  payload: MessageComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const lotteryId = payload.data?.custom_id
  if (!lotteryId) return message(undefined, { type: InteractionResponseType.DeferredMessageUpdate })

  const { lottery, error } = await context.lottery.load(lotteryId, { interaction: payload! })
  if (!lottery || error)
    return message(error?.message, { type: InteractionResponseType.DeferredMessageUpdate })

  const member = asGuildMember(payload.guild_id!, payload.member!)
  if (lottery.getPlayers().find((p) => p.id === member.id)) {
    return message('Cannot join a lottery you are already in', { isPrivate: true })
  }

  const memberRep = await context.userStore.getUserRep(member)

  if (memberRep < lottery.buyIn) {
    return message('You do not have enough rep', { isPrivate: true })
  }

  if (!lottery.canAddPlayers()) {
    return message('lottery is full', { isPrivate: true })
  }

  await lottery.addPlayer(member)

  if (lottery.shouldFinish()) {
    // eslint-disable-next-line no-console
    lottery.finish().catch((e) => console.error('lottery end error', e))
  } else {
    updateInteraction({
      applicationId: payload.application_id,
      token: payload.token,
      body: lotteryMessage(lottery),
    })
  }

  return message(undefined, { type: InteractionResponseType.DeferredMessageUpdate })
}

export async function finishLottery(
  event: { id: string; interaction: Interaction },
  context: AppContext
): Promise<void> {
  const { lottery, error } = await context.lottery.load(event.id, {
    interaction: event.interaction,
  })

  if (error || !lottery) {
    throw new Error('Error loading lottery:' + error?.message)
  }

  await lottery?.finish()
}

export function lotteryMessage(lottery: BrxLottery): MessageResponse {
  const startTime = lottery.getStart()
  if (!startTime) {
    throw new Error('no start time for lottery')
  }
  const timeRemaining = differenceInSeconds(startTime.getTime() + lotteryTimeMs, new Date())
  const creatorName = lottery.getCreator().username
  const players = lottery.getPlayers()

  const banner = lottery.isNegative
    ? `${creatorName} has started a negative lottery for ℞${lottery.getBet()} for up to ${
        lottery.playerLimit
      } players. Click the button below within ${timeRemaining} seconds to place join the lottery. The loser will pay all other players ℞${lottery.getBet()} for a maximum loss of ℞${
        lottery.buyIn
      }`
    : `${creatorName} has started a lottery for ℞${lottery.getBet()}. Click the button below within ${timeRemaining} seconds to place an equal bet and join the lottery.`

  const footer =
    players.length < 2 ? '' : `\n**Players**\n${players.map((p) => p.username).join('\n')}`

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: banner + footer,
      components: lottery.canAddPlayers() ? joinLotteryComponents(lottery.id) : [],
    },
  }
}

function joinLotteryComponents(id: string): MessageComponents {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          label: 'Join Lottery',
          style: ButtonStyle.Primary,
          custom_id: encodeCustomId(ID_TYPE, id),
        },
      ],
    },
  ]
}
