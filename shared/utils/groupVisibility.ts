import { APPLYABLE_GROUP_STATUS, CLOSED_GROUP_STATUSES } from '../constants/groupStatus'

/**
 * Client mirror of the rules `applicationService.create` enforces, so the UI can hide an
 * apply button and label a card instead of letting a visitor submit and read a 409.
 *
 * The server stays authoritative — this only decides what to render.
 */

/** A start/end date as it arrives over JSON: an ISO string, or absent. */
interface GroupDates {
  status: string
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Whether the group accepts applications right now.
 *
 * Two independent reasons it may not: the status is `FULL` or `COMPLETED`, or the event has
 * already finished while its row still says `PUBLISHED` — nothing moves a group to
 * `COMPLETED` automatically, so the date is the only thing that closes it.
 */
export function groupAcceptsApplications(group: GroupDates | null | undefined, now = new Date()): boolean {
  if (!group) return false
  if (group.status !== APPLYABLE_GROUP_STATUS) return false
  if (group.endsAt && new Date(group.endsAt).getTime() < now.getTime()) return false

  return true
}

/** Whether the event has already finished, whatever its status says. */
export function isPastGroup(group: GroupDates | null | undefined, now = new Date()): boolean {
  if (!group?.startsAt) return false

  const endsAt = group.endsAt ? new Date(group.endsAt) : null

  // A group with a start but no end date is over once it has started; one with an end date
  // stays current until that moment passes.
  return (endsAt ?? new Date(group.startsAt)).getTime() < now.getTime()
}

/** Whether the card or page should say the group is closed rather than open for applications. */
export function isClosedGroupStatus(status: string): boolean {
  return (CLOSED_GROUP_STATUSES as readonly string[]).includes(status)
}
