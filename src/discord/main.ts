import {
  DiscordInteractionResponseTypes,
  Interaction,
  ComponentInteraction,
  SlashCommandInteraction,
  InteractionResponseTypes,
  InteractionResponse,
  InteractionTypes,
  httpErrors,
} from '../deps.ts'
import { isInteractionResponse, Command } from './types.ts'
import { commands } from './interactions.ts'
import type { AppContext } from '../context.ts'

const componentCommands: Command[] = Object.values(commands).filter(
  (c): c is Command => typeof c?.canHandleInteraction === 'function'
)

export async function main(
  payload: Interaction,
  context: AppContext
): Promise<InteractionResponse> {
  if ((payload.type as number) === (InteractionTypes.Ping as number)) {
    return {
      type: InteractionResponseTypes.Pong,
    }
  } else if (
    payload.type === InteractionTypes.ApplicationCommand ||
    payload.type === InteractionTypes.MessageComponent
  ) {
    if (payload.type === InteractionTypes.ApplicationCommand && !payload.data?.name) {
      return {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content:
            'Something went wrong. I was not able to find the command name in the payload sent by Discord.',
        },
      }
    }

    const customId = ((payload as unknown) as ComponentInteraction)?.data?.customId
    const command = customId
      ? await findComponentCommand(componentCommands, customId, context)
      : commands[((payload as unknown) as SlashCommandInteraction).data!.name]

    if (!command) {
      return {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: 'Something went wrong. I was not able to find this command.',
        },
      }
    }

    const result = await command.execute(payload, context)
    if (!isInteractionResponse(result)) {
      return {
        data: result,
        type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
      }
    }

    // DENO/TS BUG DOESN'T LET US SEND A OBJECT WITHOUT THIS OVERRIDE
    return result
  }

  throw new httpErrors.BadRequest('Bad request')
}

async function findComponentCommand(
  commands: Command[],
  customId: string,
  context: AppContext
): Promise<Command | undefined> {
  for (const command of commands) {
    if (!command.canHandleInteraction) continue
    const canHandle = await command.canHandleInteraction(customId, context)
    if (canHandle) return command
  }
}
