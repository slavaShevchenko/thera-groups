/**
 * The timezone a bare calendar date from the UI is read in.
 *
 * `dateFrom` arrives from `<input type="date">` as `YYYY-MM-DD` with no zone, while
 * `startsAt` is stored as naive UTC. Parsing the filter as UTC midnight — what
 * `new Date('2026-11-05')` does — put the boundary hours away from the one the visitor
 * meant, so an event starting at 00:30 in Kyiv on 5 November (22:30Z on the 4th, in winter)
 * was dropped by `dateFrom=2026-11-05` while the card next to it displayed 5 November.
 *
 * Cards format dates in the browser's own zone, which the server does not know and which
 * would differ between SSR and hydration. One site zone is the closest match that is stable
 * everywhere, and it is the audience's zone — the same one `database/seed.ts` writes into
 * `Group.timezone`.
 */
export const SITE_TIMEZONE = 'Europe/Kyiv'

const siteParts = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * How far ahead of UTC the site zone is at a given instant, in milliseconds.
 *
 * `hour` is read modulo 24 because `hour12: false` renders midnight as `24` on some
 * platforms, which `Date.UTC` would roll into the next day.
 */
function siteOffsetAt(instant: Date): number {
  const parts = Object.fromEntries(
    siteParts.formatToParts(instant).map(part => [part.type, part.value]),
  )

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )

  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The UTC instant at which a calendar day begins in the site zone, or null when the string is
 * not a real `YYYY-MM-DD` date.
 *
 * Measured twice: the first offset is read at UTC midnight, which around a DST switch can
 * fall on the other side of it from the local midnight being computed, and the second pass
 * reads the offset where the answer actually lands.
 * @param dateOnly - A date with no time and no zone, as a date input produces
 * @returns Start of that day in `SITE_TIMEZONE`, as a UTC instant
 */
export function startOfSiteDay(dateOnly: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null

  const parsed = new Date(`${dateOnly}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null

  // V8 rolls an out-of-range ISO day over instead of rejecting it — `2026-02-30T00:00:00Z`
  // parses as 2 March — so the components are read back and compared with what was asked
  // for. Without this a malformed `dateFrom` silently filtered from some other date.
  if (parsed.toISOString().slice(0, 10) !== dateOnly) return null

  const utcMidnight = parsed.getTime()
  const firstGuess = utcMidnight - siteOffsetAt(new Date(utcMidnight))

  return new Date(utcMidnight - siteOffsetAt(new Date(firstGuess)))
}
