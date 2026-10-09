import { send, setResponseHeaders, setResponseStatus } from 'h3'
import type { H3Error, H3Event } from 'h3'
import type { NitroErrorHandler } from 'nitropack/types'
import { isUnhandledDomainFailure, isUnhandledPrismaFailure, toHttpError } from './errorHandler'

function isApiRoute(event: H3Event) {
  return event.path.startsWith('/api/')
}

/**
 * Answers raw driver and domain failures that no handler caught. Most API endpoints call
 * a repository or service directly and have no try/catch, so a `P1001` used to surface as
 * Nitro's opaque `500 Server Error` and a service's `NotFoundError` as a `500 INTERNAL`;
 * now they become the mapped 503 and 404. Mapping lives in `toHttpError` so this response
 * and the log line the Nitro `error` hook already wrote are guaranteed to agree.
 *
 * Registered through `nitro.errorHandler`, which Nitro runs *before* its own
 * built-in handler and continues past whenever this one sends no response. So
 * SSR render errors and every already-shaped failure fall through untouched.
 *
 * Logging is deliberately absent — the Nitro `error` hook in
 * `server/plugins/errorHandler.ts` fires first and already logged this failure.
 */
const nitroErrorHandler: NitroErrorHandler = async (error, event, { defaultHandler }) => {
  if (!isApiRoute(event)) return
  if (!isUnhandledPrismaFailure(error) && !isUnhandledDomainFailure(error)) return

  // createError() resolves to Nuxt's variant here, whose statusCode is optional.
  const mapped = toHttpError(error) as H3Error
  const res = await defaultHandler(mapped, event)

  if (!event.node?.res.headersSent) {
    setResponseHeaders(event, res.headers)
  }
  setResponseStatus(event, res.status, res.statusText)
  await send(event, typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2))
}

export default nitroErrorHandler
