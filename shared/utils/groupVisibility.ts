import { APPLYABLE_GROUP_STATUS, CLOSED_GROUP_STATUSES, COMPLETED_GROUP_STATUS } from '../constants/groupStatus'

/**
 * The one definition of a group's date state, read by the apply gate on the server, by the
 * UI that mirrors it, and by the ordering of every public list.
 *
 * "Has this group ended" used to be answered three different ways: the apply gate looked at
 * `endsAt`, the badges at `endsAt ?? startsAt`, the catalog ordering at `startsAt`. A group
 * that had started with no end date therefore kept taking applications while its own page
 * called it a past event, and a multi-day group running right now was filed into the
 * archive below events that had not begun.
 *
 * The `endsAt ?? startsAt` arm that settled it was wrong for the other reason: it closed an
 * open-ended group on the day it began. One definition still — `endsAt`, or a `COMPLETED`
 * row — and `startsAt` is only ever a reason to sort a group first, never to close it.
 */

/** A date as it arrives over JSON (ISO string) or straight from Prisma (`Date`). */
type DateValue = string | Date | null | undefined

interface GroupDates {
  status: string
  startsAt?: DateValue
  endsAt?: DateValue
}

/** Epoch milliseconds, or null when the value is absent or unparseable. */
function time(value: DateValue): number | null {
  if (!value) return null

  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()

  return Number.isNaN(ms) ? null : ms
}

/**
 * Whether the event is over, whichever way that was decided.
 *
 * Two ways, and only two: a person marked the row `COMPLETED`, or the end date passed.
 *
 * Only an end date finishes a group *by date*. A start date with no end date is an
 * open-ended group — a therapy or intervision group that meets weekly and has no last
 * meeting to name — so it stays open however long ago it began, and closing it takes a
 * person: an end date, `COMPLETED` or `CANCELLED`. Nothing moves a row to `COMPLETED`
 * automatically, so `endsAt` is also what closes a finished group whose owner never
 * pressed the button. A group with neither an end date behind us nor a `COMPLETED` status
 * never ends here, whatever its start date reads.
 */
export function isPastGroup(group: GroupDates | null | undefined, now = new Date()): boolean {
  if (group?.status === COMPLETED_GROUP_STATUS) return true

  const ended = time(group?.endsAt)

  if (ended === null) return false

  return ended < now.getTime()
}

/**
 * Whether the event has begun and not finished — the one a visitor can still join today.
 *
 * A group with no start date has not begun, so it is not ongoing; it is simply open, and
 * `compareGroupsForListing` files it with what is still to come.
 */
export function isOngoingGroup(group: GroupDates | null | undefined, now = new Date()): boolean {
  if (isPastGroup(group, now)) return false

  const started = time(group?.startsAt)

  if (started === null) return false

  return started < now.getTime()
}

/**
 * Whether the group accepts applications right now.
 *
 * Client mirror of the check `applicationService.create` enforces, so the UI hides the
 * button instead of letting a visitor submit and read a 409. The server stays authoritative.
 */
export function groupAcceptsApplications(group: GroupDates | null | undefined, now = new Date()): boolean {
  if (!group) return false
  if (group.status !== APPLYABLE_GROUP_STATUS) return false

  return !isPastGroup(group, now)
}

/** Whether the card or page should say the group is closed rather than open for applications. */
export function isClosedGroupStatus(status: string): boolean {
  return (CLOSED_GROUP_STATUSES as readonly string[]).includes(status)
}

/**
 * The three catalog tiers, in the order a visitor reads them: what can be joined today,
 * what has not begun yet, and the archive.
 */
const TIER_ONGOING = 0
const TIER_UPCOMING = 1
const TIER_PAST = 2

function listingTier(group: GroupDates, now: Date): number {
  if (isPastGroup(group, now)) return TIER_PAST

  return isOngoingGroup(group, now) ? TIER_ONGOING : TIER_UPCOMING
}

/**
 * Catalog order for two groups: what is running now first, most recently started first;
 * then what has not begun, soonest start first; then the archive, most recent first.
 *
 * This is `groupRepository.buildDateBuckets` expressed as a comparator, for the lists that
 * are assembled in one query and cannot be split into SQL buckets — an organizer's public
 * groups are a nested select. Both sides order a missing start date last so the two agree
 * exactly.
 */
export function compareGroupsForListing(a: GroupDates, b: GroupDates, now = new Date()): number {
  const aTier = listingTier(a, now)
  const bTier = listingTier(b, now)

  if (aTier !== bTier) return aTier - bTier

  const aStart = time(a.startsAt)
  const bStart = time(b.startsAt)

  if (aStart === null && bStart === null) return 0
  if (aStart === null) return 1
  if (bStart === null) return -1

  // Only what has not begun reads soonest first; the two tiers behind it read most recent
  // first, so the group that started yesterday outranks one started a year ago.
  return aTier === TIER_UPCOMING ? aStart - bStart : bStart - aStart
}
