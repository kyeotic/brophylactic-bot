import {
  DiscordApplicationCommandOptionTypes,
  ComponentInteraction,
  GuildMemberWithUser,
  DiscordInteractionResponseTypes,
} from '../../../deps.ts'
import { updateInteraction, asGuildMember, message } from '../../api.ts'
import type {
  CommandResponse,
  Command,
  SlashCommand,
  ApplicationCommandInteractionDataOptionInteger,
} from '../../types.ts'
import type { AppContext } from '../../../context.ts'
import { BrxLottery, lotteryMessage } from './brxLottery.ts'

export type LotteryInteraction = SlashCommand<
  [
    ApplicationCommandInteractionDataOptionInteger,
    ApplicationCommandInteractionDataOptionInteger | undefined
  ]
>

export const ID_TYPE = 'LOTTERY'

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

    return await handleLottery(payload as LotteryInteraction, context)
  },
  messageInteractionType: ID_TYPE,
}

export default command

async function handleLottery(payload: LotteryInteraction, context: AppContext) {
  // Validation
  //
  if (!payload.data?.options?.length || !payload.guildId)
    return message('missing required sub-command')

  // const options = getInitialOptions(payload)
  // if ('error' in options) return message(options.error)
  // const { amount, playerLimit } = options

  const amount = payload.data.options[0].value
  const playerLimit = payload.data.options[1]?.value

  if (!Number.isInteger(amount)) return message('amount must be an integer')

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
  if (!lottery || error) return message(error?.message ?? 'Bad request ')

  if (memberBgr < lottery.getBuyIn()) {
    return message(
      `${
        member.username
      } only has ${memberBgr} and cannot bet in a lottery whose buy-in is ℞${lottery.getBuyIn()}`
    )
  }

  await lottery.start()

  return lotteryMessage(lottery)
}

async function handleLotteryJoin(
  payload: ComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const lotteryId = payload.data?.customId
  if (!lotteryId)
    return message(undefined, { type: DiscordInteractionResponseTypes.DeferredUpdateMessage })

  const lottery = await context.lotteryCache.get(lotteryId)
  if (!lottery)
    return message(undefined, { type: DiscordInteractionResponseTypes.DeferredUpdateMessage })

  const member = asGuildMember(payload.guildId!, payload.member!)
  if (lottery.getPlayers().find((p) => p.id === member.id)) {
    return message('Cannot join a lottery you are already in', { isPrivate: true })
  }

  const memberRep = await context.userStore.getUserRep(member)

  if (memberRep < lottery.getBuyIn()) {
    return message('You do not have enough rep', { isPrivate: true })
  }

  if (!lottery.canAddPlayers) {
    return message('lottery is full', { isPrivate: true })
  }

  lottery.addPlayer(member)

  if (lottery.shouldFinish()) {
    lottery.finish().catch((e) => console.error('lottery end error', e))
  } else {
    updateInteraction({
      applicationId: payload.applicationId,
      token: payload.token,
      body: lotteryMessage(lottery),
    })
  }

  return message(undefined, { type: DiscordInteractionResponseTypes.DeferredUpdateMessage })
}
