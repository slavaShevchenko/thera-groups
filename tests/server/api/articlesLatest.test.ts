import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

vi.mock('~~/server/services/articleService', () => ({
  articleService: {
    getLatestHeadlines: vi.fn(),
  },
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { articleService } from '~~/server/services/articleService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { startOfSiteDay } from '~~/server/utils/siteTime'

const mockGetLatestHeadlines = vi.mocked(articleService.getLatestHeadlines)

function makeGetEvent(url: string) {
  return createEvent({ url, method: 'GET' }, {})
}

type LatestHandler = (_event: ReturnType<typeof makeGetEvent>) => Promise<unknown>

/**
 * A row shaped like the one `findLatestHeadlines` selects: titles only. The handler pipes it
 * through `mapArticleTeaser`, so a body or a byline here would be a chance to prove they do
 * not come back out — and their absence from the select is the reason this endpoint exists
 * separately from the paginated list.
 */
function makeHeadlineRow(slug: string, title: string, day: string) {
  return {
    slug,
    publishedAt: startOfSiteDay(day),
    updatedAt: new Date(`${day}T09:12:00.000Z`),
    translations: [{ title }],
  }
}

const headlines = [
  makeHeadlineRow('yak-obraty-hrupu', 'Як обрати групу', '2026-11-19'),
  makeHeadlineRow('sho-take-supervisiia', 'Що таке супервізія', '2026-11-12'),
]

describe('GET /api/articles/latest', () => {
  let handler: LatestHandler

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetLatestHeadlines.mockResolvedValue(headlines)

    const mod = await import('../../../server/api/articles/latest.get')
    handler = mod.default as unknown as LatestHandler
  })

  it('returns the newest headlines in the requested locale', async () => {
    const result = await handler(makeGetEvent('/api/articles/latest?locale=en'))

    expect(mockGetLatestHeadlines).toHaveBeenCalledWith('en')
    expect(result).toEqual([
      { slug: 'yak-obraty-hrupu', title: 'Як обрати групу', publishedDate: '2026-11-19' },
      { slug: 'sho-take-supervisiia', title: 'Що таке супервізія', publishedDate: '2026-11-12' },
    ])
  })

  /**
   * The block renders nothing else, so the payload carries nothing else: a bare array rather
   * than the `{ articles, total, page, totalPages }` envelope the archive needs, because a
   * discovery block has no pagination to describe.
   */
  it('answers with a bare array of the three fields the block renders', async () => {
    const result = await handler(makeGetEvent('/api/articles/latest?locale=ua'))

    expect(Array.isArray(result)).toBe(true)
    for (const teaser of result as Array<Record<string, unknown>>) {
      expect(Object.keys(teaser).sort()).toEqual(['publishedDate', 'slug', 'title'])
    }
  })

  it('defaults to Ukrainian when the caller names no locale', async () => {
    await handler(makeGetEvent('/api/articles/latest'))

    expect(mockGetLatestHeadlines).toHaveBeenCalledWith('ua')
  })

  it('refuses a locale the site does not serve', async () => {
    await expect(handler(makeGetEvent('/api/articles/latest?locale=fr')))
      .rejects.toMatchObject({ statusCode: 400, data: { code: 'VALIDATION_FAILED' } })

    expect(mockGetLatestHeadlines).not.toHaveBeenCalled()
  })

  /**
   * The count is fixed server-side by `ARTICLE_LIMITS.HOME_TEASER_COUNT`, the way the archive
   * fixes its page size: a public list is not an API a caller shapes, and a `limit` that
   * reached the query would let one request pull the table.
   */
  it('ignores a limit the caller tries to pass', async () => {
    await handler(makeGetEvent('/api/articles/latest?locale=ua&limit=1000'))

    expect(mockGetLatestHeadlines).toHaveBeenCalledWith('ua')
  })

  /** An empty archive hides the block rather than breaking the home page. */
  it('returns an empty array when nothing is published', async () => {
    mockGetLatestHeadlines.mockResolvedValue([])

    await expect(handler(makeGetEvent('/api/articles/latest?locale=ua'))).resolves.toEqual([])
  })
})
