'use strict'

const port = process.env.PORT || 3000
const { start } = require('./bot')
const Koa = require('koa')
const app = new Koa()

// response
app.use(ctx => {
  ctx.body = 'Hello Koa'
})

start()
app.listen(port)
