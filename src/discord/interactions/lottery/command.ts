import {
  DiscordApplicationCommandOptionTypes,
  ComponentInteraction,
  GuildMemberWithUser,
} from '../../../deps.ts'
import {
  updateInteraction,
  asGuildMember,
  asContent,
  privateMessage,
  ackButton,
} from '../../api.ts'
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
  canHandleInteraction: async (customId: string, context: AppContext): Promise<boolean> => {
    return !!(await context.lotteryCache.get(customId))
  },
}

export default command

async function handleLottery(payload: LotteryInteraction, context: AppContext) {
  // Validation
  //
  if (!payload.data?.options?.length || !payload.guildId)
    return asContent('missing required sub-command')

  // const options = getInitialOptions(payload)
  // if ('error' in options) return asContent(options.error)
  // const { amount, playerLimit } = options

  const amount = payload.data.options[0].value
  const playerLimit = payload.data.options[0]?.value

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

  await lottery.start()

  return lotteryMessage(lottery)
}

async function handleLotteryJoin(
  payload: ComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  // console.log('payload', payload)

  const lotteryId = payload.data?.customId
  if (!lotteryId) return ackButton()

  const lottery = await context.lotteryCache.get(lotteryId)
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
    lottery.finish().catch((e) => console.error('lottery end error', e))
  } else {
    updateInteraction({
      applicationId: payload.applicationId,
      token: payload.token,
      body: lotteryMessage(lottery),
    })
  }

  return ackButton()
}
