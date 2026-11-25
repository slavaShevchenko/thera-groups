import { describe, it, expect } from 'vitest'
import {
  APPLYABLE_GROUP_STATUS,
  CLOSED_GROUP_STATUSES,
  PUBLIC_GROUP_STATUSES,
  isPublicGroupStatus,
} from '../../shared/constants/groupStatus'
import {
  compareGroupsForListing,
  groupAcceptsApplications,
  isClosedGroupStatus,
  isOngoingGroup,
  isPastGroup,
} from '../../shared/utils/groupVisibility'

// Fixed "now" so the date arithmetic below is deterministic instead of depending on when
// the suite happens to run.
const NOW = new Date('2026-10-09T12:00:00.000Z')
const future = '2026-11-01T10:00:00.000Z'
const past = '2026-09-01T10:00:00.000Z'

describe('PUBLIC_GROUP_STATUSES', () => {
  it('lists the statuses a visitor may see', () => {
    expect([...PUBLIC_GROUP_STATUSES]).toEqual(['PUBLISHED', 'FULL', 'COMPLETED'])
  })

  it('keeps a full group visible — it was published, indexed and bookmarked', () => {
    expect(isPublicGroupStatus('FULL')).toBe(true)
  })

  it('keeps a completed group visible as the archive of a past event', () => {
    expect(isPublicGroupStatus('COMPLETED')).toBe(true)
  })

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'CANCELLED'])(
    'hides %s from an unprivileged viewer',
    (status) => {
      expect(isPublicGroupStatus(status)).toBe(false)
    },
  )

  it('treats every closed status as visible, so nothing is hidden and closed at once', () => {
    for (const status of CLOSED_GROUP_STATUSES) {
      expect(isPublicGroupStatus(status)).toBe(true)
    }
  })

  it('has exactly one applyable status', () => {
    expect(APPLYABLE_GROUP_STATUS).toBe('PUBLISHED')
    expect(isPublicGroupStatus(APPLYABLE_GROUP_STATUS)).toBe(true)
  })
})

describe('groupAcceptsApplications', () => {
  it('accepts a published group that has not ended', () => {
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: future, endsAt: null }, NOW)).toBe(true)
  })

  it('accepts a published group with no dates at all', () => {
    expect(groupAcceptsApplications({ status: 'PUBLISHED' }, NOW)).toBe(true)
  })

  it.each([...CLOSED_GROUP_STATUSES])('refuses a %s group', (status) => {
    expect(groupAcceptsApplications({ status, startsAt: future, endsAt: null }, NOW)).toBe(false)
  })

  it('refuses a group whose end date has passed even while the row still says PUBLISHED', () => {
    // Nothing moves a row to COMPLETED automatically, so the date is the only thing that
    // closes it — and the apply button has to follow the date, not the status.
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: past, endsAt: past }, NOW)).toBe(false)
  })

  it('accepts a group that has started and has no end date — open-ended is not over', () => {
    // The gate read `endsAt ?? startsAt` for a while, which closed an open-ended group on
    // the day it began: a weekly intervision group with no last meeting to name stopped
    // taking applications the moment its first one had happened.
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: past, endsAt: null }, NOW)).toBe(true)
  })

  it('accepts a group that has started but not finished', () => {
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: past, endsAt: future }, NOW)).toBe(true)
  })

  it('accepts a group that ends exactly now', () => {
    const endsNow = NOW.toISOString()
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: past, endsAt: endsNow }, NOW)).toBe(true)
  })

  it('refuses when there is no group', () => {
    expect(groupAcceptsApplications(null, NOW)).toBe(false)
    expect(groupAcceptsApplications(undefined, NOW)).toBe(false)
  })
})

describe('isPastGroup', () => {
  it('is false for a group that has not started', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: future, endsAt: null }, NOW)).toBe(false)
  })

  it('stays false once the start date has passed when there is no end date to finish on', () => {
    // The whole point of the rule: a start date closes nothing, so an open-ended group is
    // not in the past however long ago it began.
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: past, endsAt: null }, NOW)).toBe(false)
  })

  it('stays false between the start and the end date', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: past, endsAt: future }, NOW)).toBe(false)
  })

  it('is true once the end date has passed', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: past, endsAt: past }, NOW)).toBe(true)
  })

  it('is true once the end date has passed, even with no start date to fall back on', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: null, endsAt: past }, NOW)).toBe(true)
  })

  it('is false with no dates at all', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: null, endsAt: null }, NOW)).toBe(false)
    expect(isPastGroup(null, NOW)).toBe(false)
  })

  it('is true for a COMPLETED row whatever its dates say', () => {
    // A person pressed "Mark as completed", which outranks the calendar: closing a group
    // early leaves an `endsAt` still in the future and the group is over anyway. Without this
    // arm a completed group with no end date sorted back into the ongoing tier.
    expect(isPastGroup({ status: 'COMPLETED', startsAt: null, endsAt: null }, NOW)).toBe(true)
    expect(isPastGroup({ status: 'COMPLETED', startsAt: future, endsAt: future }, NOW)).toBe(true)
  })

  it('is false for a FULL row, which is closed but not over — a seat may free up', () => {
    expect(isPastGroup({ status: 'FULL', startsAt: past, endsAt: future }, NOW)).toBe(false)
  })
})

describe('isOngoingGroup', () => {
  it('is true between the start date and the end date', () => {
    expect(isOngoingGroup({ status: 'PUBLISHED', startsAt: past, endsAt: future }, NOW)).toBe(true)
  })

  it('is true for a group that has started and has no end date to finish on', () => {
    expect(isOngoingGroup({ status: 'PUBLISHED', startsAt: past, endsAt: null }, NOW)).toBe(true)
  })

  it('is false for a group that has not begun', () => {
    expect(isOngoingGroup({ status: 'PUBLISHED', startsAt: future, endsAt: null }, NOW)).toBe(false)
  })

  it('is false for a group with no start date, which has not begun either', () => {
    // Not ongoing, but not ended: `compareGroupsForListing` files it with what is still to
    // come rather than dropping it out of the catalog.
    expect(isOngoingGroup({ status: 'PUBLISHED', startsAt: null, endsAt: null }, NOW)).toBe(false)
  })

  it('is false once the end date has passed, however recent the start', () => {
    expect(isOngoingGroup({ status: 'PUBLISHED', startsAt: past, endsAt: past }, NOW)).toBe(false)
  })

  it('is false for a COMPLETED group, which is over by decision rather than by date', () => {
    expect(isOngoingGroup({ status: 'COMPLETED', startsAt: past, endsAt: null }, NOW)).toBe(false)
  })

  it('is false when there is no group', () => {
    expect(isOngoingGroup(null, NOW)).toBe(false)
    expect(isOngoingGroup(undefined, NOW)).toBe(false)
  })
})

describe('compareGroupsForListing', () => {
  const running = { status: 'PUBLISHED', startsAt: past, endsAt: future }
  const upcomingSoon = { status: 'PUBLISHED', startsAt: '2026-11-01T10:00:00.000Z', endsAt: null }
  const upcomingLater = { status: 'PUBLISHED', startsAt: '2026-12-01T10:00:00.000Z', endsAt: null }
  const undated = { status: 'PUBLISHED', startsAt: null, endsAt: null }
  // Started, no end date: ongoing, and the reason the catalog needs a tier of its own —
  // sorted with the upcoming events one of these outranks all of them forever.
  const openEndedRecent = { status: 'PUBLISHED', startsAt: '2026-10-01T10:00:00.000Z', endsAt: null }
  const openEndedOld = { status: 'PUBLISHED', startsAt: '2026-01-05T10:00:00.000Z', endsAt: null }
  const endedRecently = {
    status: 'COMPLETED',
    startsAt: '2026-09-20T10:00:00.000Z',
    endsAt: '2026-09-21T10:00:00.000Z',
  }
  const endedLongAgo = {
    status: 'COMPLETED',
    startsAt: '2026-01-10T10:00:00.000Z',
    endsAt: '2026-01-11T10:00:00.000Z',
  }

  type Row = { status: string, startsAt?: string | Date | null, endsAt?: string | Date | null }

  const sort = (groups: Row[]) =>
    [...groups].sort((a, b) => compareGroupsForListing(a, b, NOW))

  it('keeps a group that is still running above the archive', () => {
    expect(sort([endedRecently, running])).toEqual([running, endedRecently])
  })

  it('keeps an open-ended group above events that have not begun, however long ago it started', () => {
    expect(sort([upcomingSoon, openEndedOld])).toEqual([openEndedOld, upcomingSoon])
  })

  it('orders the groups that are running now most recently started first', () => {
    expect(sort([openEndedOld, openEndedRecent])).toEqual([openEndedRecent, openEndedOld])
  })

  it('orders what is still to come soonest first, undated last', () => {
    expect(sort([undated, upcomingLater, upcomingSoon]))
      .toEqual([upcomingSoon, upcomingLater, undated])
  })

  it('orders the archive most recent first', () => {
    expect(sort([endedLongAgo, endedRecently])).toEqual([endedRecently, endedLongAgo])
  })

  it('takes the Date objects the server sorts, not only ISO strings', () => {
    const later = { ...upcomingLater, startsAt: new Date(upcomingLater.startsAt) }
    const soon = { ...upcomingSoon, startsAt: new Date(upcomingSoon.startsAt) }

    expect(sort([later, soon])).toEqual([soon, later])
  })
})

describe('isClosedGroupStatus', () => {
  it.each([...CLOSED_GROUP_STATUSES])('is true for %s', (status) => {
    expect(isClosedGroupStatus(status)).toBe(true)
  })

  it('is false for a status that is still taking applications', () => {
    expect(isClosedGroupStatus('PUBLISHED')).toBe(false)
  })

  it('is false for a status that is not public at all — those are hidden, not closed', () => {
    expect(isClosedGroupStatus('CANCELLED')).toBe(false)
    expect(isClosedGroupStatus('DRAFT')).toBe(false)
  })
})
