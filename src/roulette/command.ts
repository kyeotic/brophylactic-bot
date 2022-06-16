import { asGuildMember, message, encodeCustomId } from '../discord/api'
import { differenceInSeconds } from '../util/dates'
import { rouletteTimeMs } from './roulette'

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
  SlashCommand,
  MessageComponentCommand,
  SlashCommandOptions,
  CommandInteractionInteger,
} from '../discord/types'

import type { AppContext } from '../di'
import type { Roulette } from './roulette'

export type RouletteInteraction = SlashCommandOptions<[CommandInteractionInteger]>

export const ID_TYPE = 'ROULETTE'

const command: SlashCommand<RouletteInteraction> & MessageComponentCommand = {
  id: 'roulette',
  // global: true,
  guild: true,
  description: 'Starts a game of roulette',
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
    payload: RouletteInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return await handleRoulette(payload, context)
  },
  handleMessage: async function (
    payload: MessageComponentInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return handleRouletteJoin(payload, context)
  },
}

export default command

async function handleRoulette(
  payload: RouletteInteraction,
  context: AppContext
): Promise<CommandResponse> {
  // Validation
  //
  if (!payload.data?.options?.length || !payload.guild_id)
    return message('missing required sub-command')

  const amount = payload.data.options[0].value

  if (!Number.isInteger(amount)) return message('amount must be an integer')

  // Init Roulette
  //
  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)
  const memberBgr = await context.userStore.getUserRep(member)

  const { roulette, error } = context.roulette.init({
    creator: member,
    bet: amount,
  })
  if (!roulette || error) return message(error?.message ?? 'Bad request ')

  if (memberBgr < roulette.buyIn) {
    return message(
      `${member.username} only has ${memberBgr} and cannot bet in a roulette game whose buy-in is ℞${roulette.buyIn}`
    )
  }

  await roulette.start(payload as unknown as Interaction)

  return rouletteMessage(roulette)
}

async function handleRouletteJoin(
  payload: MessageComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const rouletteId = payload.data?.custom_id
  if (!rouletteId)
    return message(undefined, { type: InteractionResponseType.DeferredMessageUpdate })

  const { roulette, error } = await context.roulette.load(rouletteId, { interaction: payload! })
  if (!roulette || error)
    return message(error?.message, { type: InteractionResponseType.DeferredMessageUpdate })

  const member = asGuildMember(payload.guild_id!, payload.member!)
  if (roulette.getPlayers().find((p) => p.id === member.id)) {
    return message('Cannot join a roulette game you are already in', { isPrivate: true })
  }

  const memberRep = await context.userStore.getUserRep(member)

  if (memberRep < roulette.buyIn) {
    return message('You do not have enough rep', { isPrivate: true })
  }

  await roulette.addPlayer(member)

  return rouletteMessage(roulette, InteractionResponseType.UpdateMessage)
}

export async function finishRoulette(
  event: { id: string; interaction: Interaction },
  context: AppContext
): Promise<void> {
  const { roulette, error } = await context.roulette.load(event.id, {
    interaction: event.interaction,
  })

  if (error || !roulette) {
    throw new Error('Error loading roulette:' + error?.message)
  }

  const finalMessage = await roulette?.finish()

  await context.discord.updateInteraction({
    applicationId: event.interaction.application_id,
    token: event.interaction.token,
    body: {
      content: finalMessage,
      components: [],
    },
  })
}

function rouletteMessage(
  roulette: Roulette,
  type:
    | InteractionResponseType.ChannelMessageWithSource
    | InteractionResponseType.UpdateMessage = InteractionResponseType.ChannelMessageWithSource
): MessageResponse {
  const startTime = roulette.getStart()
  if (!startTime) {
    throw new Error('no start time for roulette')
  }
  const timeRemaining = differenceInSeconds(startTime.getTime() + rouletteTimeMs, new Date())
  const creatorName = roulette.getCreator().username
  const players = roulette.getPlayers()

  const banner = `${creatorName} has started a roulette game for ℞${roulette.getBet()}. Click the button below within ${timeRemaining} seconds to place an equal bet and join the game.`

  const footer =
    players.length < 2 ? '' : `\n**Players**\n\n${players.map((p) => p.username).join('\n')}`

  return {
    type,
    data: {
      content: banner + footer,
      components: rouletteComponents(roulette.id),
    },
  }
}

function rouletteComponents(id: string): MessageComponents {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          label: 'Join Roulette',
          style: ButtonStyle.Primary,
          custom_id: encodeCustomId(ID_TYPE, id),
        },
      ],
    },
  ]
}
