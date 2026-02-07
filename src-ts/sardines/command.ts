import { asGuildMember, message, messageButton, encodeCustomId, bgrLabel } from '../discord/api'
import { joinFailureChance, MIN_PLAYERS_BEFORE_REJOIN } from './sardines'
import { isToday } from '../util/dates'

import {
  ButtonStyle,
  ComponentType,
  ApplicationCommandOptionType,
  InteractionResponseType,
} from '../discord/types'

import type {
  MessageComponentInteraction,
  DiscordGuildMemberWithUser,
  MessageComponents,
  CommandResponse,
  MessageResponse,
  SlashCommand,
  MessageComponentCommand,
  SlashCommandOptions,
  CommandInteractionInteger,
} from '../discord/types'

import type { AppContext } from '../di'
import type { Sardines } from './sardines'

export type SardinesInteraction = SlashCommandOptions<[CommandInteractionInteger]>

export const ID_TYPE = 'SARDINES'

const command: SlashCommand<SardinesInteraction> & MessageComponentCommand = {
  id: 'sardines',
  // global: true,
  guild: true,
  description: 'Starts a game of sardines',
  options: [
    {
      name: 'bet',
      required: true,
      type: ApplicationCommandOptionType.Integer,
      description: 'amount of rep for the buy-in. Cannot exceed your total rep',
    },
  ],
  messageInteractionType: ID_TYPE,
  handleSlashCommand: async function (
    payload: SardinesInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return await handleSardines(payload, context)
  },
  handleMessage: async function (
    payload: MessageComponentInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return handleSardinesJoin(payload, context)
  },
}

export default command

async function handleSardines(
  payload: SardinesInteraction,
  context: AppContext
): Promise<CommandResponse> {
  // Validation
  //
  if (!payload.data?.options?.length || !payload.guild_id)
    return message('missing required sub-command')

  const amount = payload.data.options[0].value

  if (!Number.isInteger(amount)) return message('amount must be an integer')

  // Init Sardines
  //
  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)
  const memberBgr = await context.userStore.getUserRep(member)
  const lastSardines = await context.userStore.getUserLastSardines(member)

  if (lastSardines && isToday(context.config.discord.timezone, lastSardines)) {
    return message('You already started a sardines game today', { isPrivate: true })
  }

  const { sardines, error } = context.sardines.init({
    creator: member,
    bet: amount,
  })
  if (!sardines || error) return message(error?.message ?? 'Bad request ')

  if (memberBgr < sardines.buyIn) {
    return message(
      `${
        member.username
      } only has ${memberBgr} and cannot bet in a sardines game whose buy-in is ${bgrLabel(
        sardines.buyIn
      )}`
    )
  }

  await sardines.start()

  await context.userStore.setUserLastSardines(member, new Date())

  return sardinesMessage(sardines)
}

async function handleSardinesJoin(
  payload: MessageComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const sardinesId = payload.data?.custom_id
  if (!sardinesId)
    return message(undefined, { type: InteractionResponseType.DeferredMessageUpdate })

  const { sardines, error } = await context.sardines.load(sardinesId, { interaction: payload! })
  if (!sardines || error)
    return message(error?.message, { type: InteractionResponseType.DeferredMessageUpdate })

  const member = asGuildMember(payload.guild_id!, payload.member!)
  if (!sardines.canJoinRepeat() && sardines.getPlayers().find((p) => p.id === member.id)) {
    return message(
      `Cannot join a sardines game you are already in until the minimum player count of ${MIN_PLAYERS_BEFORE_REJOIN} is met.`,
      { isPrivate: true }
    )
  }

  const memberRep = await context.userStore.getUserRep(member)

  if (memberRep < sardines.buyIn) {
    return message('You do not have enough rep', { isPrivate: true })
  }

  if (sardines.canAddPlayer()) {
    await sardines.addPlayer(member)
    return sardinesMessage(sardines, InteractionResponseType.UpdateMessage)
  } else {
    const finalMessage = await sardines.finish(member)
    return message(finalMessage, { type: InteractionResponseType.UpdateMessage, components: [] })
  }
}

function sardinesMessage(
  sardines: Sardines,
  type:
    | InteractionResponseType.ChannelMessageWithSource
    | InteractionResponseType.UpdateMessage = InteractionResponseType.ChannelMessageWithSource
): MessageResponse {
  const startTime = sardines.getStart()
  if (!startTime) {
    throw new Error('no start time for sardines')
  }
  const creatorName = sardines.getCreator().username
  const players = sardines.getPlayers()

  const failureChance = (joinFailureChance(players.length) * 100).toPrecision(2)
  const banner = `${creatorName} has started a sardines game for ${bgrLabel(
    sardines.getBet()
  )}. Click the button below to pay the buy-in and attempt to join the game.\nThere is currently a ${failureChance}% chance of ending the game when joining. A winner is randomly selected among all players in the game _before_ it ends.`

  const footer =
    players.length < 2 ? '' : `\n\n**Players**\n${players.map((p) => p.username).join('\n')}`

  return message(banner + footer, {
    type,
    components: messageButton(encodeCustomId(ID_TYPE, sardines.id), 'Join Sardines'),
  })
}
