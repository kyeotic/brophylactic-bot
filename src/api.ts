import { verifyKey } from './discord/signature'
import { initContext } from './di'
import { main } from './discord/main'
import camelize from 'camelcase-keys'

import type { Interaction } from './discord/types'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda'

export async function handler(
  event: APIGatewayProxyEventV2,
  lambdaContext: Context
): Promise<APIGatewayProxyResultV2> {
  const context = initContext(lambdaContext)
  console.log('request received', event.body)

  if (!event.body) {
    return response(400, { error: 'Body is required' })
  }

  const isValid = verifyDiscordRequest(context.config.discord.publicKey, event.headers, event.body)

  if (!isValid) {
    return response(401, { error: 'Invalid request; could not verify the request' })
  }

  const payload = camelize<Interaction>(JSON.parse(event.body))

  try {
    // return await response(200, { message: 'test' })
    const resp = response(200, await main(payload, context))
    // console.log('response', resp)
    return resp
  } catch (e) {
    return response(e.status || 500, e.message)
  }
}

function response(
  statusCode: number,
  body: unknown,
  headers: Record<string, string | undefined> = {}
): APIGatewayProxyResultV2 {
  if (!headers['content-type'] && headers['content-type'] !== null) {
    headers['content-type'] = 'application/json'
  }
  return {
    statusCode,
    headers: headers as Record<string, string>,
    body: body && typeof body === 'object' ? JSON.stringify(body) : (body as string | undefined),
  }
}

function verifyDiscordRequest(
  publicKey: string,
  headers: Record<string, string | undefined>,
  body: string
): boolean {
  if (!publicKey) {
    throw new Error('Missing Discord public key')
  }

  const signature = headers['x-signature-ed25519']
  const timestamp = headers['x-signature-timestamp']

  if (!signature || !timestamp) {
    console.log('Request missing x-signature-ed25519 or x-signature-timestamp')
    return false
  }

  const isValid = verifyKey(body, signature, timestamp, publicKey)

  return isValid
}
