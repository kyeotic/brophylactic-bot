import { parseCustomId, message } from './api'
import {
  isInteractionResponse,
  DiscordInteractionResponseTypes,
  DiscordInteractionTypes,
} from './types'
import { commands } from './interactions'
import type { AppContext } from '../di'
import { assertNever } from '../util/assert'

import type {
  Interaction,
  ComponentInteraction,
  SlashCommandInteraction,
  InteractionResponse,
  InteractionApplicationCommandCallbackData,
} from './types'

const interactions = [
  DiscordInteractionTypes.ApplicationCommand,
  DiscordInteractionTypes.MessageComponent,
]

// deno-lint-ignore require-await
export async function main(
  payload: Interaction,
  context: AppContext
): Promise<InteractionResponse> {
  // Basic Validation
  //
  if (payload.type === DiscordInteractionTypes.Ping) {
    return { type: DiscordInteractionResponseTypes.Pong }
  } else if (!interactions.includes(payload.type)) {
    throw new Error('Bad request')
  }

  // Routing
  //
  // await ackDeferred({
  //   interactionId: payload.id,
  //   token: payload.token,
  // })

  switch (payload.type) {
    case DiscordInteractionTypes.ApplicationCommand:
      return handleAppCommand(payload, context)
    case DiscordInteractionTypes.MessageComponent:
      return handleMessageInteraction(payload, context)
    default:
      throw new Error('Bad request')
    // This is throwing a typescript error, likely because the types are from different source
    // return assertNever(payload)
  }
}

async function handleAppCommand(
  payload: SlashCommandInteraction,
  context: AppContext
): Promise<InteractionResponse> {
  if (!payload.data?.name) {
    return missingType()
  }

  const command = commands[payload.data!.name]

  if (!command) return missingCommand()

  const result = await command.execute(payload, context)

  if (!isInteractionResponse(result)) return interactionCallback(result)

  return result
}

async function handleMessageInteraction(
  payload: ComponentInteraction,
  context: AppContext
): Promise<InteractionResponse> {
  if (!payload?.data?.customId) {
    return missingType()
  }

  const [idType, customId] = parseCustomId(payload?.data?.customId)

  const command = Object.values(commands).find((c) => c?.messageInteractionType === idType)

  if (!command) return missingCommand()

  // Replace encoded customId
  payload.data.customId = customId
  const result = await command.execute(payload, context)

  if (!isInteractionResponse(result)) return interactionCallback(result)

  return result
}

function interactionCallback(data: InteractionApplicationCommandCallbackData): InteractionResponse {
  return {
    data,
    type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
  }
}

function missingCommand(): InteractionResponse {
  return message('Something went wrong. I was not able to find this command.')
}

function missingType(): InteractionResponse {
  return message(
    'Something went wrong. I was not able to find the command name in the payload sent by Discord.'
  )
}
