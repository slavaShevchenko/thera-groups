import { describe, it, expect } from 'vitest'
import type { GroupData } from '~~/types'
import { buildBreadcrumbJsonLd, buildGroupEventJsonLd } from '~~/app/utils/jsonLd'

const SITE_URL = 'https://psygroup.org'
const CANONICAL = `${SITE_URL}/ua/groups/anxiety-group`

function makeGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: 'group-1',
    slug: 'anxiety-group',
    isFavorited: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    type: 'THERAPEUTIC',
    title: 'Група підтримки при тривозі',
    description: 'Опис групи',
    program: null,
    format: 'OFFLINE',
    status: 'PUBLISHED',
    startsAt: '2026-11-10T16:00:00.000Z',
    endsAt: '2026-12-10T18:00:00.000Z',
    capacity: 12,
    minParticipants: 4,
    durationHours: 2,
    certificateIssued: false,
    priceAmount: 500,
    currency: 'UAH',
    location: 'Київ, вул. Хрещатик 1',
    tags: [],
    organizer: {
      slug: 'olena-k',
      firstName: 'Олена',
      lastName: 'Коваль',
      avatarUrl: null,
      qualification: 'Психолог',
      experienceYears: 8,
      specializations: [],
      bio: null,
      verificationStatus: 'VERIFIED',
    },
    coOrganizers: [],
    viewer: { canEdit: false, canViewUnpublished: false },
    ...overrides,
  }
}

function event(overrides: Partial<GroupData> = {}, acceptsApplications = true) {
  return JSON.parse(buildGroupEventJsonLd({
    group: makeGroup(overrides),
    siteUrl: SITE_URL,
    canonicalUrl: CANONICAL,
    locale: 'ua',
    acceptsApplications,
  })) as Record<string, unknown>
}

describe('buildBreadcrumbJsonLd', () => {
  it('builds every step from siteUrl, never from the request origin', () => {
    const jsonLd = buildBreadcrumbJsonLd({
      items: [
        { name: 'Головна', path: '/ua' },
        { name: 'Каталог', path: '/ua/catalog' },
        { name: 'Група' },
      ],
      siteUrl: SITE_URL,
      currentPath: '/ua/groups/anxiety-group',
    })

    expect(JSON.parse(jsonLd!)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Головна', 'item': `${SITE_URL}/ua` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Каталог', 'item': `${SITE_URL}/ua/catalog` },
        { '@type': 'ListItem', 'position': 3, 'name': 'Група', 'item': CANONICAL },
      ],
    })
  })

  it('omits item on a middle step that has no path rather than inventing one', () => {
    const jsonLd = buildBreadcrumbJsonLd({
      items: [
        { name: 'Головна', path: '/ua' },
        { name: 'Без шляху' },
        { name: 'Поточна' },
      ],
      siteUrl: SITE_URL,
      currentPath: '/ua/whatever',
    })

    const steps = JSON.parse(jsonLd!).itemListElement as Record<string, unknown>[]

    expect(steps[1]).toEqual({ '@type': 'ListItem', 'position': 2, 'name': 'Без шляху' })
    expect(steps[2].item).toBe(`${SITE_URL}/ua/whatever`)
  })

  it('returns null when the page is not indexable', () => {
    expect(buildBreadcrumbJsonLd({
      items: [{ name: 'Головна', path: '/ua' }],
      siteUrl: SITE_URL,
      currentPath: '/ua/profile',
      indexable: false,
    })).toBeNull()
  })

  it('returns null when there is no trail at all', () => {
    expect(buildBreadcrumbJsonLd({
      items: [],
      siteUrl: SITE_URL,
      currentPath: '/ua',
    })).toBeNull()
  })
})

describe('buildGroupEventJsonLd', () => {
  it('carries the page URL and an absolute image', () => {
    const jsonLd = event()

    expect(jsonLd.url).toBe(CANONICAL)
    expect(jsonLd.image).toBe(`${SITE_URL}/images/card/offline.webp`)
  })

  it('picks the image from the format', () => {
    expect(event({ format: 'ONLINE' }).image).toBe(`${SITE_URL}/images/card/online.webp`)
    expect(event({ format: 'HYBRID' }).image).toBe(`${SITE_URL}/images/card/hybrid.webp`)
    expect(event({ format: null }).image).toBe(`${SITE_URL}/images/card/online.webp`)
  })

  it('gives an offline event a place with an address', () => {
    expect(event().location).toEqual({
      '@type': 'Place',
      'name': 'Київ, вул. Хрещатик 1',
      'address': 'Київ, вул. Хрещатик 1',
    })
  })

  it('gives an online event the page to join from', () => {
    expect(event({ format: 'ONLINE' }).location).toEqual({
      '@type': 'VirtualLocation',
      'url': CANONICAL,
    })
  })

  it('gives a hybrid event both locations', () => {
    expect(event({ format: 'HYBRID' }).location).toEqual([
      { '@type': 'VirtualLocation', 'url': CANONICAL },
      { '@type': 'Place', 'name': 'Київ, вул. Хрещатик 1', 'address': 'Київ, вул. Хрещатик 1' },
    ])
  })

  it('drops the location instead of naming an offline event "online"', () => {
    expect(event({ location: null }).location).toBeUndefined()
    expect(event({ format: 'HYBRID', location: null }).location)
      .toEqual({ '@type': 'VirtualLocation', 'url': CANONICAL })
  })

  it('points the offer at the page a ticket is claimed on', () => {
    expect(event().offers).toEqual({
      '@type': 'Offer',
      'url': CANONICAL,
      'price': 500,
      'priceCurrency': 'UAH',
      'availability': 'https://schema.org/InStock',
    })
  })

  it('omits the offer on a group that cannot be applied to', () => {
    expect(event({ status: 'FULL' }, false).offers).toBeUndefined()
  })

  it('omits the offer when there is no price', () => {
    expect(event({ priceAmount: null }).offers).toBeUndefined()
  })

  it('links the organizer only when they have a public page', () => {
    expect(event().organizer).toEqual({
      '@type': 'Person',
      'name': 'Олена Коваль',
      'url': `${SITE_URL}/ua/organizers/olena-k`,
    })

    const slugless = event({
      organizer: { ...makeGroup().organizer!, slug: '' },
    })
    expect(slugless.organizer).toEqual({ '@type': 'Person', 'name': 'Олена Коваль' })

    expect(event({ organizer: null }).organizer).toBeUndefined()
  })

  it('maps the attendance mode to the format', () => {
    expect(event({ format: 'ONLINE' }).eventAttendanceMode)
      .toBe('https://schema.org/OnlineEventAttendanceMode')
    expect(event({ format: 'HYBRID' }).eventAttendanceMode)
      .toBe('https://schema.org/MixedEventAttendanceMode')
    expect(event({ format: 'OFFLINE' }).eventAttendanceMode)
      .toBe('https://schema.org/OfflineEventAttendanceMode')
  })
})
