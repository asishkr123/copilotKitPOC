import pino from 'pino'
import { asyncLocalStorage } from './context'
const logLevel = process.env.LOG_LEVEL || 'debug'

const rootLogger = pino({
  name: 'template-nextjs-logger',
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime
})

/**
 * Automatically enrich logs with context from AsyncLocalStorage.
 * No need to pass logger manually.
 */
export const getLogger = (name = 'app', additionalParams = {}) => {
  const store = asyncLocalStorage.getStore()
  const contextMeta =
    store && Object.keys(store)?.length
      ? {
          requestId: store.requestId,
          reqUrl: store.requestUrl
        }
      : {}

  return rootLogger.child({
    name,
    level: logLevel,
    ...contextMeta,
    ...additionalParams
  })
}
