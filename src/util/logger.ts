import config from '../config'
import { Logger, LineFormatter, JsonFormatter } from 'lambda-logger-node'

const logger = Logger({
  minimumLogLevel: config.stage === 'test' ? 'SILENT' : config.stage === 'prod' ? 'WARN' : 'DEBUG',
  useBearerRedactor: false,
  // We are not exporting logs anywhere yet, so prod doesn't need the JSON noise
  formatter: config.stage === 'prod' ? LineFormatter : JsonFormatter,
})

export default logger
