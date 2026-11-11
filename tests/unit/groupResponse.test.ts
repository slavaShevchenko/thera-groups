import { describe, it, expect } from 'vitest'
import { mapGroupCard, mapGroupForPublic } from '../../server/utils/groupResponse'

/**
 * A detail row as `groupRepository.findBySlug` returns it: every scalar column Prisma
 * selects, including the ones that must never reach a visitor.
 */
function makeDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cuid-group',
    slug: 'support-group',
    title: 'Група підтримки',
    description: 'Body text',
    program: 'Weekly programme',
    type: 'SUPPORT',
    format: 'ONLINE',
    location: null,
    languages: ['uk', 'es'],
    startsAt: new Date('2026-11-01T10:00:00.000Z'),
    endsAt: new Date('2026-12-01T10:00:00.000Z'),
    capacity: 12,
    minParticipants: 4,
    durationHours: 2,
    certificateIssued: false,
    priceAmount: '1500.00',
    currency: 'UAH',
    status: 'PUBLISHED',
    timezone: 'Europe/Kyiv',
    rejectionReason: 'Не вказано кваліфікацію',
    organizerId: 'cuid-profile',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    organizer: {
      id: 'cuid-profile',
      userId: 'cuid-owner',
      firstName: 'Олена',
      lastName: 'Коваль',
      slug: 'olena-koval',
      avatarUrl: null,
      bio: 'Психологиня',
      qualification: 'MA Psychology',
      specializations: ['CBT'],
      experienceYears: 8,
      verificationStatus: 'VERIFIED',
    },
    coOrganizers: [
      {
        userId: 'cuid-co',
        role: 'CO_ORGANIZER',
        user: {
          id: 'cuid-co-user',
          organizerProfile: {
            firstName: 'Іван',
            lastName: 'Петренко',
            avatarUrl: null,
            slug: 'ivan-petrenko',
          },
        },
      },
    ],
    tags: [{ id: 'cuid-tag', name: 'Тривожність', slug: 'tryvozhnist' }],
    ...overrides,
  }
}

const viewer = { isFavorited: false, canEdit: false, canViewUnpublished: false }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mapper reads a Prisma row shape
const detail = (overrides: Record<string, unknown> = {}) => mapGroupForPublic(makeDetailRow(overrides) as any, viewer)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mapper reads a Prisma row shape
const card = (overrides: Record<string, unknown> = {}) => mapGroupCard(makeDetailRow(overrides) as any)

describe('mapGroupForPublic', () => {
  it('uses the slug as the public identifier and never emits the cuid', () => {
    const mapped = detail()

    expect(mapped.id).toBe('support-group')
    expect(mapped.slug).toBe('support-group')
    expect(JSON.stringify(mapped)).not.toContain('cuid-')
  })

  it('strips every field an anonymous visitor has no business reading', () => {
    const mapped = detail() as Record<string, unknown>

    for (const key of ['organizerId', 'rejectionReason', 'updatedAt']) {
      expect(mapped, key).not.toHaveProperty(key)
    }
  })

  it('strips userId from the organizer and keeps only what the page renders', () => {
    const { organizer } = detail()

    expect(organizer).not.toHaveProperty('userId')
    expect(organizer).not.toHaveProperty('id')
    expect(organizer).toEqual({
      slug: 'olena-koval',
      firstName: 'Олена',
      lastName: 'Коваль',
      avatarUrl: null,
      qualification: 'MA Psychology',
      experienceYears: 8,
      specializations: ['CBT'],
      bio: 'Психологиня',
      verificationStatus: 'VERIFIED',
    })
  })

  it('flattens co-organizers so no nested user record or id survives', () => {
    const [co] = detail().coOrganizers

    expect(co).toEqual({
      slug: 'ivan-petrenko',
      firstName: 'Іван',
      lastName: 'Петренко',
      avatarUrl: null,
      role: 'CO_ORGANIZER',
    })
  })

  it('survives a co-organizer whose account has no organizer profile', () => {
    const mapped = detail({
      coOrganizers: [{ userId: 'cuid-co', role: 'CO_ORGANIZER', user: { id: 'cuid-co-user', organizerProfile: null } }],
    })

    expect(mapped.coOrganizers).toEqual([
      { slug: null, firstName: '', lastName: '', avatarUrl: null, role: 'CO_ORGANIZER' },
    ])
    expect(JSON.stringify(mapped)).not.toContain('cuid-')
  })

  it('renders a group with no organizer as null rather than throwing', () => {
    expect(detail({ organizer: null }).organizer).toBeNull()
  })

  it('reduces tags to name and slug, dropping their cuids', () => {
    expect(detail().tags).toEqual([{ name: 'Тривожність', slug: 'tryvozhnist' }])
  })

  it('carries the languages the event runs in, as stored', () => {
    expect(detail().languages).toEqual(['uk', 'es'])
    // An empty array is the normal state for a group nobody set languages on, and the page
    // hides the row rather than rendering an empty label.
    expect(detail({ languages: [] }).languages).toEqual([])
  })

  it('converts a Decimal price to a number, so a free group is 0 and not "0.00"', () => {
    expect(detail().priceAmount).toBe(1500)
    expect(detail({ priceAmount: '0.00' }).priceAmount).toBe(0)
    expect(detail({ priceAmount: null }).priceAmount).toBeNull()
  })

  it('carries status and endsAt, which is what the page closes the apply button on', () => {
    const mapped = detail({ status: 'FULL' })

    expect(mapped.status).toBe('FULL')
    expect(mapped.endsAt).toEqual(new Date('2026-12-01T10:00:00.000Z'))
  })

  it('reports the server-computed viewer flags instead of ids to check them against', () => {
    expect(detail().viewer).toEqual({ canEdit: false, canViewUnpublished: false })
    expect(detail().isFavorited).toBe(false)

    const privileged = mapGroupForPublic(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma row shape
      makeDetailRow() as any,
      { isFavorited: true, canEdit: true, canViewUnpublished: true },
    )

    expect(privileged.viewer).toEqual({ canEdit: true, canViewUnpublished: true })
    expect(privileged.isFavorited).toBe(true)
  })
})

describe('mapGroupCard', () => {
  it('uses the slug as the public identifier and never emits a cuid', () => {
    const mapped = card()

    expect(mapped.id).toBe('support-group')
    expect(JSON.stringify(mapped)).not.toContain('cuid-')
  })

  it('omits detail-only fields a card never renders', () => {
    const mapped = card() as Record<string, unknown>

    for (const key of [
      'description', 'program', 'timezone', 'rejectionReason', 'organizerId',
      'updatedAt', 'createdAt', 'tags', 'minParticipants', 'durationHours',
      'certificateIssued', 'languages',
    ]) {
      expect(mapped, key).not.toHaveProperty(key)
    }
  })

  it('keeps what a card shows, including status and endsAt for the closing badge', () => {
    expect(card()).toMatchObject({
      slug: 'support-group',
      title: 'Група підтримки',
      type: 'SUPPORT',
      format: 'ONLINE',
      capacity: 12,
      priceAmount: 1500,
      currency: 'UAH',
      status: 'PUBLISHED',
    })
    expect(card().endsAt).toEqual(new Date('2026-12-01T10:00:00.000Z'))
  })

  it('strips userId from the organizer and co-organizers', () => {
    const mapped = card()

    expect(mapped.organizer).toEqual({ firstName: 'Олена', lastName: 'Коваль', avatarUrl: null })
    expect(mapped.coOrganizers[0]).not.toHaveProperty('userId')
    expect(mapped.coOrganizers[0]).toMatchObject({ firstName: 'Іван', slug: 'ivan-petrenko' })
  })

  it('has no viewer block — a card is the same for everybody', () => {
    expect(card()).not.toHaveProperty('viewer')
    expect(card()).not.toHaveProperty('isFavorited')
  })
})
