/**
 * ofetch reports the response status as `status` on the browser and as `statusCode` on
 * the H3Error that Nitro's SSR fetch rejects with, so both have to be read.
 */
export function fetchErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  const { status, statusCode } = error as { status?: unknown, statusCode?: unknown }
  if (typeof statusCode === 'number') return statusCode
  if (typeof status === 'number') return status

  return undefined
}

/**
 * A 403/404 is a verdict about the page, not a transient failure — retrying cannot
 * change it, so it belongs on the error page rather than in a "failed to load" card.
 */
export function isPermanentFetchFailure(error: unknown): boolean {
  const status = fetchErrorStatus(error)
  return status === 403 || status === 404
}
