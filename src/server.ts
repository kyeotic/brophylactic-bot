import config from './config.ts'
import { OakApplication as Application, OakRouter as Router } from './deps.ts'
import { initContext } from './context.ts'
import { routeMain } from './discord/main.ts'

const app = new Application()

const router = new Router()

router.get('/', routeMain)

app.use((ctx) => {
  ctx.state.appContext = initContext()
})
app.use(router.routes())
app.use(router.allowedMethods())

app.addEventListener('listen', ({ hostname, port, secure }) => {
  console.log(`Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`)
})

await app.listen({ port: config.port })
