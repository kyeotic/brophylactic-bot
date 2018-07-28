import Koa from 'koa'
import { start } from './bot'

const port = process.env.PORT || 3000
const app = new Koa()

// response
app.use(ctx => {
  ctx.body = 'Hello Koa'
})

start()
app.listen(port)
