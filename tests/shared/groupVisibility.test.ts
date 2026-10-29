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

  it('refuses a group that has started and has no end date to wait for', () => {
    // This gate used to read `endsAt` alone, so the group kept taking applications forever
    // while the badge on the same page called it a past event.
    expect(groupAcceptsApplications({ status: 'PUBLISHED', startsAt: past, endsAt: null }, NOW)).toBe(false)
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

  it('is true once the start date has passed and there is no end date', () => {
    expect(isPastGroup({ status: 'PUBLISHED', startsAt: past, endsAt: null }, NOW)).toBe(true)
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

  it('is false with no dates at all, whatever the status says', () => {
    expect(isPastGroup({ status: 'COMPLETED', startsAt: null, endsAt: null }, NOW)).toBe(false)
    expect(isPastGroup(null, NOW)).toBe(false)
  })
})

describe('compareGroupsForListing', () => {
  const running = { status: 'PUBLISHED', startsAt: past, endsAt: future }
  const upcomingSoon = { status: 'PUBLISHED', startsAt: '2026-11-01T10:00:00.000Z', endsAt: null }
  const upcomingLater = { status: 'PUBLISHED', startsAt: '2026-12-01T10:00:00.000Z', endsAt: null }
  const undated = { status: 'PUBLISHED', startsAt: null, endsAt: null }
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
