import {
  DiscordInteractionResponseTypes,
  Interaction,
  ComponentInteraction,
  SlashCommandInteraction,
  InteractionResponseTypes,
  InteractionResponse,
  InteractionTypes,
  InteractionApplicationCommandCallbackData,
  httpErrors,
} from '../deps.ts'
import { parseCustomId } from './api.ts'
import { isInteractionResponse } from './types.ts'
import { commands } from './interactions.ts'
import type { AppContext } from '../context.ts'
import { assertNever } from '../util/assert.ts'

const interactions = [InteractionTypes.ApplicationCommand, InteractionTypes.MessageComponent]

// deno-lint-ignore require-await
export async function main(
  payload: Interaction,
  context: AppContext
): Promise<InteractionResponse> {
  // Basic Validation
  //
  if ((payload.type as number) === (InteractionTypes.Ping as number)) {
    return { type: InteractionResponseTypes.Pong }
  } else if (!interactions.includes(payload.type)) {
    throw new httpErrors.BadRequest('Bad request')
  }

  // Routing
  //
  switch (payload.type) {
    case InteractionTypes.ApplicationCommand:
      return handleAppCommand(payload, context)
    case InteractionTypes.MessageComponent:
      return handleMessageInteraction(payload, context)
    default:
      return assertNever(payload)
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
  return {
    type: InteractionResponseTypes.ChannelMessageWithSource,
    data: {
      content: 'Something went wrong. I was not able to find this command.',
    },
  }
}

function missingType(): InteractionResponse {
  return {
    type: InteractionResponseTypes.ChannelMessageWithSource,
    data: {
      content:
        'Something went wrong. I was not able to find the command name in the payload sent by Discord.',
    },
  }
}
