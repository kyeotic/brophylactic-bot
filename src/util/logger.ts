import pino from 'pino'

const level = process.env.LOG_LEVEL || (process.env.stage === 'prod' ? 'info' : 'debug')

const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})

export default logger
