import { headers } from 'next/headers'
import { asyncLocalStorage } from './context'
import { v4 as uuidv4 } from 'uuid'

export function withAsyncContextHandler(handler) {
  return async (request) => {
    const headersList = await headers()
    const requestId = headersList.get('x-request-id') || uuidv4()
    const requestUrl = request.url
    return asyncLocalStorage.run({ requestId, requestUrl }, handler)
  }
}
