import {
  verifySignature,
  RouterContext,
  camelize,
  DiscordInteractionResponseTypes,
  Interaction,
  InteractionResponseTypes,
  InteractionTypes,
} from '../deps.ts'
import config from '../config.ts'
import { botRespond } from './api.ts'
import { commands, isInteractionResponse } from './interactions/mod.ts'
import { json } from '../util/requests.ts'
import type { AppContext } from '../context.ts'

export async function main(payload: Interaction, context: AppContext): Promise<[number, any]> {
  if ((payload.type as number) === (InteractionTypes.Ping as number)) {
    return [
      200,
      {
        type: InteractionResponseTypes.Pong,
      },
    ]
  } else if (payload.type === InteractionTypes.ApplicationCommand) {
    if (!payload.data?.name) {
      return [
        200,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: {
            content:
              'Something went wrong. I was not able to find the command name in the payload sent by Discord.',
          },
        },
      ]
    }

    const command = commands[payload.data.name]
    if (!command) {
      return [
        200,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: {
            content: 'Something went wrong. I was not able to find this command.',
          },
        },
      ]
    }

    const result = await command.execute(payload, context)
    if (!isInteractionResponse(result)) {
      return [
        200,
        {
          data: result,
          type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
        },
      ]
    }

    // DENO/TS BUG DOESN'T LET US SEND A OBJECT WITHOUT THIS OVERRIDE
    return [200, (result as unknown) as { [key: string]: unknown }]
  }

  return [400, { error: 'Bad request' }]
}

export async function botMain(interaction: Interaction, context: AppContext) {
  const [, body] = await main(interaction, context)

  await botRespond(interaction.id, interaction.token, body)

  return
}

export async function routeMain(ctx: RouterContext) {
  const result = ctx.request.body({ type: 'text' })
  const input = await result.value

  if (!config.isLocal) {
    const isValid = verifyDiscordRequest(config.discord.publicKey, ctx.request, input)

    if (!isValid) {
      return json(ctx, 401, { error: 'Invalid request; could not verify the request' })
    }
  }

  const payload = camelize<Interaction>(JSON.parse(input))

  const [status, body] = await main(payload, ctx.state.appContext as AppContext)

  return json(ctx, status, body)
}

function verifyDiscordRequest(
  publicKey: string,
  request: RouterContext['request'],
  body: string
): boolean {
  if (!publicKey) {
    throw new Error('Missing Discord public key')
  }

  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')

  if (!signature || !timestamp) {
    console.log('Request missing X-Signature-Ed25519 or X-Signature-Timestamp')
    return false
  }

  const { isValid } = verifySignature({
    publicKey,
    signature,
    timestamp,
    body,
  })
  return isValid
}
