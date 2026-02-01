import http from 'node:http'
import { verifyKey } from './discord/signature'
import { initContext } from './di'
import { main } from './discord/main'

import type { Interaction } from './discord/types'

const context = initContext()
const logger = context.logger

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (req.method === 'POST' && req.url === '/') {
    try {
      const body = await readBody(req)

      const isValid = verifyDiscordRequest(
        context.config.discord.publicKey,
        req.headers as Record<string, string>,
        body
      )

      if (!isValid) {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request; could not verify the request' }))
        return
      }

      const payload = JSON.parse(body) as Interaction
      const result = await main(payload, context)

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e: any) {
      const status = e.status || 500
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

const port = context.config.port

context.jobQueue.start()

server.listen(port, () => {
  logger.info(`Server listening on port ${port}`)
})

function shutdown() {
  logger.info('Shutting down...')
  context.jobQueue.stop()
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function verifyDiscordRequest(
  publicKey: string,
  headers: Record<string, string | undefined>,
  body: string
): boolean {
  const signature = headers['x-signature-ed25519']
  const timestamp = headers['x-signature-timestamp']

  if (!signature || !timestamp) {
    logger.warn('Request missing x-signature-ed25519 or x-signature-timestamp')
    return false
  }

  return verifyKey(body, signature, timestamp, publicKey)
}
