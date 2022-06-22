import { message, encodeCustomId, bgrLabel, messageButton } from '../discord/api'

import { InteractionResponseType } from '../discord/types'

import type {
  MessageComponentInteraction,
  CommandResponse,
  SlashCommand,
  MessageComponentCommand,
  SlashCommandOptions,
} from '../discord/types'

import type { AppContext } from '../di'
import { nanoid } from 'nanoid'
import { randomInclusive } from '../util/random'

export type DebugInteraction = SlashCommandOptions<[]>

export const ID_TYPE = 'DEBUG'

const command: SlashCommand<DebugInteraction> & MessageComponentCommand = {
  id: ID_TYPE.toLowerCase(),
  // global: true,
  guild: true,
  description: 'Run debug commands',
  options: [],
  messageInteractionType: ID_TYPE,
  handleSlashCommand: async function (
    payload: DebugInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return await handleCommand(payload, context)
  },
  handleMessage: async function (
    payload: MessageComponentInteraction,
    context: AppContext
  ): Promise<CommandResponse> {
    return handleMessage(payload, context)
  },
}

export default command

async function handleCommand(
  payload: DebugInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const id = nanoid()
  return message(`This is a content debug: ${bgrLabel(200)}`, {
    type: InteractionResponseType.ChannelMessageWithSource,
    components: messageButton(encodeCustomId(ID_TYPE, id), 'Debug'),
  })
}

async function handleMessage(
  payload: MessageComponentInteraction,
  context: AppContext
): Promise<CommandResponse> {
  const customId = payload.data.custom_id
  const user = payload.member?.user?.id
  return message(`This is a content debug: ${bgrLabel(randomInclusive(50, 100))}. Hey <@${user}>`, {
    type: InteractionResponseType.UpdateMessage,
    components: messageButton(encodeCustomId(ID_TYPE, customId), 'Debug'),
  })
}
