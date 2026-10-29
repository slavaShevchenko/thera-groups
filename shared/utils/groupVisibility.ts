import { APPLYABLE_GROUP_STATUS, CLOSED_GROUP_STATUSES } from '../constants/groupStatus'

/**
 * The one definition of a group's date state, read by the apply gate on the server, by the
 * UI that mirrors it, and by the ordering of every public list.
 *
 * "Has this group ended" used to be answered three different ways: the apply gate looked at
 * `endsAt`, the badges at `endsAt ?? startsAt`, the catalog ordering at `startsAt`. A group
 * that had started with no end date therefore kept taking applications while its own page
 * called it a past event, and a multi-day group running right now was filed into the
 * archive below events that had not begun.
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
 * Whether the event has already finished, whatever the status column says.
 *
 * The end date when there is one, otherwise the start date: a group with a start and no end
 * is over once it has started. Nothing moves a row to `COMPLETED` automatically, so this is
 * what closes a past group that still says `PUBLISHED`. A group with no dates at all never
 * ends — it stays open and listed.
 */
export function isPastGroup(group: GroupDates | null | undefined, now = new Date()): boolean {
  const boundary = time(group?.endsAt) ?? time(group?.startsAt)

  if (boundary === null) return false

  return boundary < now.getTime()
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
 * Catalog order for two groups: events that have not ended first, soonest start first, then
 * the archive most recent first.
 *
 * This is `groupRepository.buildDateBuckets` expressed as a comparator, for the lists that
 * are assembled in one query and cannot be split into two SQL buckets — an organizer's
 * public groups are a nested select. Both sides order nulls last so the two agree exactly.
 */
export function compareGroupsForListing(a: GroupDates, b: GroupDates, now = new Date()): number {
  const aPast = isPastGroup(a, now)
  const bPast = isPastGroup(b, now)

  if (aPast !== bPast) return aPast ? 1 : -1

  const aStart = time(a.startsAt)
  const bStart = time(b.startsAt)

  if (aStart === null && bStart === null) return 0
  if (aStart === null) return 1
  if (bStart === null) return -1

  return aPast ? bStart - aStart : aStart - bStart
}
