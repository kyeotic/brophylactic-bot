import config from './config.ts'
import {
  OakApplication as Application,
  OakRouter as Router,
  RouterContext,
  verifySignature,
  camelize,
  Interaction,
} from './deps.ts'
import { initContext, AppContext } from './context.ts'
import { main } from './discord/main.ts'
import { json } from './util/requests.ts'

const app = new Application()

const router = new Router()

router.get('/', async (ctx) => {
  const result = ctx.request.body({ type: 'text' })
  const input = await result.value

  if (!config.isLocal) {
    const isValid = verifyDiscordRequest(config.discord.publicKey, ctx.request, input)

    if (!isValid) {
      return json(ctx, 401, { error: 'Invalid request; could not verify the request' })
    }
  }

  const payload = camelize<Interaction>(JSON.parse(input))

  try {
    const response = await main(payload, ctx.state.appContext as AppContext)
    return json(ctx, 200, response)
  } catch (e) {
    return json(ctx, e.status || 500, e.message)
  }
})

app.use((ctx) => {
  ctx.state.appContext = initContext()
})
app.use(router.routes())
app.use(router.allowedMethods())

app.addEventListener('listen', ({ hostname, port, secure }) => {
  console.log(`Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`)
})

await app.listen({ port: config.port })

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
