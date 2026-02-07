import { parseCustomId, message } from './api'
import { isInteractionResponse, InteractionResponseType, InteractionType } from './types'
import { slashCommands, messageCommands } from '../commands/mod'
import type { AppContext } from '../di'
import { assertNever } from '../util/assert'

import type {
  Interaction,
  ApplicationCommandInteraction,
  MessageComponentInteraction,
  SlashCommandInteraction,
  InteractionResponse,
  InteractionResponseCallback,
} from './types'

export async function main(
  payload: Interaction,
  context: AppContext
): Promise<InteractionResponse> {
  switch (payload.type) {
    case InteractionType.Ping:
      return { type: InteractionResponseType.Pong }
    case InteractionType.ApplicationCommand:
      return handleAppCommand(payload, context)
    case InteractionType.MessageComponent:
      return handleMessageInteraction(payload, context)
    case InteractionType.ApplicationCommandAutocomplete:
    case InteractionType.ModalSubmit:
      throw new Error('Unsupported Interaction Type')
    default:
      return assertNever(payload)
  }
}

async function handleAppCommand(
  payload: ApplicationCommandInteraction,
  context: AppContext
): Promise<InteractionResponse> {
  if (!payload.data?.name) {
    return missingType()
  }

  const command = slashCommands.get(payload.data.name)

  if (!command || !command.handleSlashCommand) {
    context.logger.warn(
      { name: payload.data.name, commands: [...slashCommands.keys()] },
      'Command not found'
    )
    return missingCommand()
  }

  const result = await command.handleSlashCommand(
    payload as unknown as SlashCommandInteraction,
    context
  )

  if (!isInteractionResponse(result)) return interactionCallback(result)

  return result
}

async function handleMessageInteraction(
  payload: MessageComponentInteraction,
  context: AppContext
): Promise<InteractionResponse> {
  const messageId = payload?.data?.custom_id
  if (!messageId) {
    return missingType()
  }

  const [idType, customId] = parseCustomId(messageId)

  const command = messageCommands.get(idType)

  if (!command || !command.handleMessage) {
    context.logger.warn({ idType, commands: [...messageCommands.keys()] }, 'Command not found')
    return missingCommand()
  }

  // Replace encoded customId
  payload.data.custom_id = customId
  const result = await command.handleMessage(payload as MessageComponentInteraction, context)

  if (!isInteractionResponse(result)) return interactionCallback(result)

  return result
}

function interactionCallback(data: InteractionResponseCallback): InteractionResponse {
  return {
    data,
    type: InteractionResponseType.ChannelMessageWithSource,
  }
}

function missingCommand(): InteractionResponse {
  return message('Something went wrong. I was not able to find this command.', { isPrivate: true })
}

function missingType(): InteractionResponse {
  return message(
    'Something went wrong. I was not able to find the command name in the payload sent by Discord.',
    { isPrivate: true }
  )
}
