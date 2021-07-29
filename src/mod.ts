import {
  camelize,
  DiscordInteractionResponseTypes,
  Interaction,
  InteractionResponseTypes,
  InteractionTypes,
  json,
  serve,
  validateRequest,
  verifySignature,
} from './deps.ts'
import { commands } from './commands/mod.ts'
import hasPermissionLevel from './commands/permissionLevels.ts'
import { isInteractionResponse } from './util/isInteractionResponse.ts'
// import { logWebhook } from './utils/logWebhook.ts'
import redeploy from './util/redeploy.ts'

serve({
  '/': main,
  '/redeploy': redeploy,
})

async function main(request: Request) {
  // Validate the incoming request; whether or not, it includes
  // the specified headers that are sent by Discord.
  const { error } = await validateRequest(request, {
    POST: {
      headers: ['X-Signature-Ed25519', 'X-Signature-Timestamp'],
    },
  })
  if (error) {
    return json({ error: error.message }, { status: error.status })
  }

  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY')
  if (!publicKey) {
    return json({
      error: 'Missing Discord public key from environment variables.',
    })
  }

  const signature = request.headers.get('X-Signature-Ed25519')!
  const timestamp = request.headers.get('X-Signature-Timestamp')!

  const { body, isValid } = verifySignature({
    publicKey,
    signature,
    timestamp,
    body: await request.text(),
  })
  if (!isValid) {
    return json(
      { error: 'Invalid request; could not verify the request' },
      {
        status: 401,
      }
    )
  }

  const payload = camelize<Interaction>(JSON.parse(body))
  if (payload.type === InteractionTypes.Ping) {
    return json({
      type: InteractionResponseTypes.Pong,
    })
  } else if (payload.type === InteractionTypes.ApplicationCommand) {
    if (!payload.data?.name) {
      return json({
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content:
            'Something went wrong. I was not able to find the command name in the payload sent by Discord.',
        },
      })
    }

    const command = commands[payload.data.name]
    if (!command) {
      return json({
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: 'Something went wrong. I was not able to find this command.',
        },
      })
    }

    // Make sure the user has the permission to run this command.
    if (!(await hasPermissionLevel(command, payload))) {
      return json({
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: payload.guildId!,
        },
      })
    }

    const result = await command.execute(payload)
    if (!isInteractionResponse(result)) {
      // await logWebhook(payload).catch(console.error)
      return json({
        data: result,
        type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
      })
    }

    // DENO/TS BUG DOESNT LET US SEND A OBJECT WITHOUT THIS OVERRIDE
    return json((result as unknown) as { [key: string]: unknown })
  }

  return json({ error: 'Bad request' }, { status: 400 })
}