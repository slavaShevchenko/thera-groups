import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { articleService, incompleteLocales } from '../../server/services/articleService'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { ConflictError, NotFoundError, ValidationError } from '../../server/utils/domainErrors'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { siteDayString, startOfSiteDay } from '../../server/utils/siteTime'
// eslint-disable-next-line import/first -- import must follow vi.mock()
import { ARTICLE_LIMITS } from '../../shared/constants/limits'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

const ACTOR = { userId: 'admin-1' }

/** A stored row as `findBySlugForAdmin` returns it: the article plus its author and locales. */
function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-1',
    slug: 'support-group',
    status: 'DRAFT',
    authorId: null,
    authorName: null,
    publishedAt: null,
    createdById: 'admin-1',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    author: null,
    translations: [],
    ...overrides,
  }
}

/** Both locales finished, which is the only state an article publishes from. */
function bothTranslations() {
  return {
    ua: { title: 'Група підтримки', content: '## Чому це працює' },
    en: { title: 'A support group', content: '## Why it works' },
  }
}

/** The rows `findTranslationLocales` reads back inside the transaction. */
function storedTranslations(...locales: ('ua' | 'en')[]) {
  prisma.articleTranslation.findMany.mockResolvedValue(
    locales.map(locale => ({ locale, title: 'Назва', content: 'Текст' })),
  )
}

// The last call, so a test that creates twice can assert on the second one.
function createdData() {
  return prisma.article.create.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>
}

function updatedData() {
  return prisma.article.update.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>
}

/**
 * The Prisma call behind `articleRepository.upsertTranslation`. These suites go through the
 * real repository — the way `groupService.test.ts` goes through the real `groupRepository` —
 * so the assertions are about the query that would reach the database, not about the
 * repository method's own argument list.
 */
function translationUpsert(locale: 'ua' | 'en', data: { title: string, content: string }) {
  return {
    where: { articleId_locale: { articleId: 'article-1', locale } },
    create: { articleId: 'article-1', locale, ...data },
    update: data,
  }
}

function translationDelete(locale: 'ua' | 'en') {
  return { where: { articleId: 'article-1', locale } }
}

/**
 * Everything inside `create`/`update` runs on the transaction handle, so the assertions are
 * about what reached the mocks through it. `tests/setup.ts` wires `$transaction` to call the
 * function with the same mock client, which is why `tx.article` and `prisma.article` are one.
 */
describe('incompleteLocales', () => {
  it('is empty when both locales have a title and a body', () => {
    expect(incompleteLocales([
      { locale: 'ua', title: 'Назва', content: 'Текст' },
      { locale: 'en', title: 'Title', content: 'Body' },
    ])).toEqual([])
  })

  it('names a locale with no row at all', () => {
    expect(incompleteLocales([{ locale: 'ua', title: 'Назва', content: 'Текст' }])).toEqual(['en'])
    expect(incompleteLocales([])).toEqual(['ua', 'en'])
  })

  /**
   * A row exists the moment the form saves a half-written language, so "exists" cannot be the
   * test — only a title and a body that are more than whitespace mean the language is done.
   */
  it('counts a whitespace-only title or body as missing', () => {
    expect(incompleteLocales([
      { locale: 'ua', title: 'Назва', content: 'Текст' },
      { locale: 'en', title: '   ', content: 'Body' },
    ])).toEqual(['en'])

    expect(incompleteLocales([
      { locale: 'ua', title: 'Назва', content: '\n\n' },
      { locale: 'en', title: 'Title', content: 'Body' },
    ])).toEqual(['ua'])
  })
})

describe('articleService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.article.findUnique.mockResolvedValue(null)
    prisma.article.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => makeArticle(data))
  })

  it('creates a blank draft from an empty payload', async () => {
    await articleService.create({}, ACTOR)

    expect(createdData()).toMatchObject({ status: 'DRAFT', publishedAt: null, authorId: null, authorName: null })
    expect(prisma.articleTranslation.upsert).not.toHaveBeenCalled()
  })

  it('records who created it', async () => {
    await articleService.create({}, { userId: 'admin-9' })

    expect(createdData().createdById).toBe('admin-9')
  })

  describe('the slug', () => {
    it('is derived from the Ukrainian title when none is given', async () => {
      await articleService.create({ translations: bothTranslations() }, ACTOR)

      expect(createdData().slug).toBe('hrupa-pidtrymky')
    })

    it('falls back to the English title, then to a placeholder', async () => {
      await articleService.create({ translations: { en: { title: 'A support group', content: 'Body' } } }, ACTOR)
      expect(createdData().slug).toBe('a-support-group')

      await articleService.create({}, ACTOR)
      expect(createdData().slug).toBe('article')
    })

    it('suffixes a derived slug that is taken rather than refusing it', async () => {
      // Only the bare base is taken: a blanket "taken" would exhaust the generator's six
      // attempts and answer a ConflictError, which is the explicit-slug behaviour, not this.
      prisma.article.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) =>
        where.slug === 'hrupa-pidtrymky' ? { id: 'someone-elses' } : null)

      await articleService.create({ translations: bothTranslations() }, ACTOR)

      const slug = createdData().slug as string
      expect(slug).toMatch(/^hrupa-pidtrymky-[a-f0-9]{6}$/)
    })

    /**
     * A slug an admin typed is an address they intend to keep, so a collision is reported
     * rather than silently suffixed — the URL in the browser has to be the one asked for.
     */
    it('refuses an explicit slug that is taken', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'someone-elses' })

      await expect(articleService.create({ slug: 'support-group' }, ACTOR))
        .rejects.toBeInstanceOf(ConflictError)
      expect(prisma.article.create).not.toHaveBeenCalled()
    })

    it('accepts an explicit slug that is free, unchanged', async () => {
      await articleService.create({ slug: 'my-own-address' }, ACTOR)

      expect(createdData().slug).toBe('my-own-address')
    })
  })

  describe('the byline', () => {
    it('checks a linked organizer exists before writing the row', async () => {
      prisma.organizerProfile.findUnique.mockResolvedValue(null)

      await expect(articleService.create({ authorId: 'profile-missing' }, ACTOR))
        .rejects.toBeInstanceOf(NotFoundError)
      expect(prisma.article.create).not.toHaveBeenCalled()
    })

    it('links the profile it found', async () => {
      prisma.organizerProfile.findUnique.mockResolvedValue({ id: 'profile-1' })

      await articleService.create({ authorId: 'profile-1' }, ACTOR)

      expect(createdData().authorId).toBe('profile-1')
    })

    it('stores a free-text name trimmed, and an empty one as no author', async () => {
      await articleService.create({ authorName: '  Олена Коваль  ' }, ACTOR)
      expect(createdData().authorName).toBe('Олена Коваль')

      await articleService.create({ authorName: '   ' }, ACTOR)
      expect(createdData().authorName).toBeNull()
    })
  })

  describe('the publish gate', () => {
    it('publishes an article that is complete in both locales', async () => {
      await articleService.create({
        status: 'PUBLISHED',
        publishedAt: '2026-11-19',
        translations: bothTranslations(),
      }, ACTOR)

      expect(createdData()).toMatchObject({
        status: 'PUBLISHED',
        publishedAt: startOfSiteDay('2026-11-19'),
      })
    })

    /**
     * The rule the whole public surface rests on: hreflang advertises both locales on every
     * article, the sitemap emits a `<url>` pair, and `/en/articles/[slug]` is a real route.
     * Google requires an advertised alternate not to 404, so a one-language article cannot
     * be published — it would invalidate the hreflang set for every article on the site.
     */
    it('refuses to publish with one locale missing', async () => {
      const promise = articleService.create({
        status: 'PUBLISHED',
        translations: { ua: { title: 'Назва', content: 'Текст' } },
      }, ACTOR)

      await expect(promise).rejects.toBeInstanceOf(ValidationError)
      await promise.catch((error: ValidationError) => {
        expect(error.field).toBe('translations')
        expect(error.message).toContain('en')
      })
      expect(prisma.article.create).not.toHaveBeenCalled()
    })

    it('refuses to publish a locale whose row is blank', async () => {
      await expect(articleService.create({
        status: 'PUBLISHED',
        translations: { ...bothTranslations(), en: { title: '', content: '' } },
      }, ACTOR)).rejects.toBeInstanceOf(ValidationError)
    })

    it('does not gate a draft, which is the state a half-written article lives in', async () => {
      await articleService.create({
        status: 'DRAFT',
        translations: { ua: { title: 'Назва', content: '' } },
      }, ACTOR)

      expect(createdData().status).toBe('DRAFT')
    })

    it('publishes with today in the site zone when no day was chosen', async () => {
      await articleService.create({ status: 'PUBLISHED', translations: bothTranslations() }, ACTOR)

      expect(createdData().publishedAt).toEqual(startOfSiteDay(siteDayString()))
    })

    /**
     * The schema checks the shape of a day, not that it exists: V8 rolls `2026-02-30` over to
     * 2 March instead of rejecting it. Catching it here answers a 400 naming the field, where
     * a rollover would publish an article dated a day nobody chose.
     */
    it('refuses a day that does not exist', async () => {
      const promise = articleService.create({ publishedAt: '2026-02-30' }, ACTOR)

      await expect(promise).rejects.toBeInstanceOf(ValidationError)
      await promise.catch((error: ValidationError) => expect(error.field).toBe('publishedAt'))
    })
  })

  describe('writing translations', () => {
    it('writes every locale the payload carries', async () => {
      await articleService.create({ translations: bothTranslations() }, ACTOR)

      expect(prisma.articleTranslation.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.articleTranslation.upsert)
        .toHaveBeenNthCalledWith(1, translationUpsert('ua', {
          title: 'Група підтримки',
          content: '## Чому це працює',
        }))
      expect(prisma.articleTranslation.upsert)
        .toHaveBeenNthCalledWith(2, translationUpsert('en', {
          title: 'A support group',
          content: '## Why it works',
        }))
    })

    /**
     * The markdown source is what is stored, not a rendered document, so an edit round-trips
     * losslessly and a change to the renderer reaches every existing article.
     */
    it('stores the body exactly as submitted', async () => {
      await articleService.create({
        translations: { ua: { title: '  Назва  ', content: '  **жирний** і <script>  ' } },
      }, ACTOR)

      // The title is trimmed because it is rendered as text and as a `<title>`; the body is
      // stored byte for byte because it is markdown, where leading whitespace is meaning.
      expect(prisma.articleTranslation.upsert).toHaveBeenCalledWith(translationUpsert('ua', {
        title: 'Назва',
        content: '  **жирний** і <script>  ',
      }))
    })

    it('removes a locale the payload emptied, so the gate keeps telling the truth', async () => {
      await articleService.create({ translations: { ua: { title: '', content: '' } } }, ACTOR)

      expect(prisma.articleTranslation.upsert).not.toHaveBeenCalled()
      expect(prisma.articleTranslation.deleteMany).toHaveBeenCalledWith(translationDelete('ua'))
    })

    it('leaves a locale the payload does not mention alone', async () => {
      await articleService.create({ translations: { en: { title: 'Title', content: 'Body' } } }, ACTOR)

      expect(prisma.articleTranslation.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.articleTranslation.deleteMany).not.toHaveBeenCalled()
    })
  })
})

describe('articleService.update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.organizerProfile.findUnique.mockResolvedValue({ id: 'profile-1' })
    prisma.article.update.mockResolvedValue(makeArticle())
  })

  function givenArticle(overrides: Record<string, unknown> = {}) {
    prisma.article.findUnique.mockResolvedValue(makeArticle(overrides))
  }

  it('throws 404 for a slug that does not exist', async () => {
    prisma.article.findUnique.mockResolvedValue(null)

    await expect(articleService.update('nope', {})).rejects.toBeInstanceOf(NotFoundError)
    expect(prisma.article.update).not.toHaveBeenCalled()
  })

  /**
   * The gate runs on every update whose *effective* status is PUBLISHED, not only on the
   * transition into it: emptying the English title of a live article would otherwise leave a
   * published URL whose hreflang alternate names a language it no longer has.
   */
  it('re-checks the gate on a published article even when the request never mentions status', async () => {
    givenArticle({ status: 'PUBLISHED', publishedAt: startOfSiteDay('2026-11-19') })
    // The state this commit will leave behind: the request emptied the English title, so
    // `writeTranslations` deleted that row before the gate read back.
    storedTranslations('ua')

    const promise = articleService.update('support-group', {
      translations: { en: { title: '', content: '' } },
    })

    await expect(promise).rejects.toBeInstanceOf(ValidationError)
    await promise.catch((error: ValidationError) => expect(error.field).toBe('translations'))
    expect(prisma.article.update).not.toHaveBeenCalled()
  })

  it('publishes on the transition when both locales survive the merge', async () => {
    givenArticle({ status: 'DRAFT' })
    storedTranslations('ua', 'en')

    await articleService.update('support-group', {
      status: 'PUBLISHED',
      publishedAt: '2026-11-19',
      translations: bothTranslations(),
    })

    expect(updatedData()).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: startOfSiteDay('2026-11-19'),
    })
  })

  it('does not read the translations back for a draft, which has nothing to gate', async () => {
    givenArticle({ status: 'DRAFT' })

    await articleService.update('support-group', { translations: { ua: { title: 'Назва', content: '' } } })

    expect(prisma.articleTranslation.findMany).not.toHaveBeenCalled()
    expect(updatedData().status).toBe('DRAFT')
  })

  /**
   * Unpublishing has to work on an article that is already incomplete — that is one of the
   * reasons to unpublish it — so the gate cannot run on the way down.
   */
  it('lets a published article return to draft without satisfying the gate', async () => {
    givenArticle({ status: 'PUBLISHED', publishedAt: startOfSiteDay('2026-11-19') })

    await articleService.update('support-group', { status: 'DRAFT' })

    expect(prisma.articleTranslation.findMany).not.toHaveBeenCalled()
    expect(updatedData().status).toBe('DRAFT')
  })

  describe('the publication day', () => {
    it('keeps the stored day when the request does not carry one', async () => {
      const stored = startOfSiteDay('2026-10-01')
      givenArticle({ status: 'DRAFT', publishedAt: stored })

      await articleService.update('support-group', { authorName: 'Олена' })

      expect(updatedData().publishedAt).toEqual(stored)
    })

    it('clears the day on a draft that asks for it to be cleared', async () => {
      givenArticle({ status: 'DRAFT', publishedAt: startOfSiteDay('2026-10-01') })

      await articleService.update('support-group', { publishedAt: null })

      expect(updatedData().publishedAt).toBeNull()
    })

    /**
     * A published row cannot be undated — the database CHECKs it — so clearing the field on
     * the way to PUBLISHED means "today" rather than a constraint violation surfaced as a 500.
     */
    it('replaces a cleared day with today when the article is published', async () => {
      givenArticle({ status: 'PUBLISHED', publishedAt: startOfSiteDay('2026-10-01') })
      storedTranslations('ua', 'en')

      await articleService.update('support-group', { publishedAt: null })

      expect(updatedData().publishedAt).toEqual(startOfSiteDay(siteDayString()))
    })

    it('refuses a day that does not exist', async () => {
      givenArticle({ status: 'DRAFT' })

      await expect(articleService.update('support-group', { publishedAt: '2026-02-30' }))
        .rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('the byline has one source', () => {
    /**
     * A form sends only the field the admin touched, so choosing one source has to clear the
     * other here rather than in the schema — without it, picking an organizer on an article
     * that had a free-text author would write both and fail the CHECK constraint.
     */
    it('clears a free-text name when an organizer is linked', async () => {
      givenArticle({ status: 'DRAFT', authorName: 'Олена Коваль' })

      await articleService.update('support-group', { authorId: 'profile-1' })

      expect(updatedData()).toMatchObject({
        author: { connect: { id: 'profile-1' } },
        authorName: null,
      })
    })

    it('disconnects the organizer when a free-text name is typed', async () => {
      givenArticle({ status: 'DRAFT', authorId: 'profile-1' })

      await articleService.update('support-group', { authorName: 'Запрошений автор' })

      expect(updatedData()).toMatchObject({
        authorName: 'Запрошений автор',
        author: { disconnect: true },
      })
    })

    it('leaves the byline untouched when the request says nothing about it', async () => {
      givenArticle({ status: 'DRAFT', authorId: 'profile-1' })

      await articleService.update('support-group', { status: 'DRAFT' })

      const data = updatedData()
      expect('author' in data).toBe(false)
      expect('authorName' in data).toBe(false)
    })

    it('clears both when both arrive as null', async () => {
      givenArticle({ status: 'DRAFT', authorId: 'profile-1' })

      await articleService.update('support-group', { authorId: null, authorName: null })

      expect(updatedData()).toMatchObject({ author: { disconnect: true }, authorName: null })
    })

    it('refuses an author profile that does not exist', async () => {
      givenArticle({ status: 'DRAFT' })
      prisma.organizerProfile.findUnique.mockResolvedValue(null)

      await expect(articleService.update('support-group', { authorId: 'profile-missing' }))
        .rejects.toBeInstanceOf(NotFoundError)
      expect(prisma.article.update).not.toHaveBeenCalled()
    })
  })

  it('removes a locale the request emptied and writes the ones it carries', async () => {
    givenArticle({ status: 'DRAFT' })

    await articleService.update('support-group', {
      translations: { ua: { title: '', content: '' }, en: { title: 'Title', content: 'Body' } },
    })

    expect(prisma.articleTranslation.deleteMany).toHaveBeenCalledWith(translationDelete('ua'))
    expect(prisma.articleTranslation.upsert)
      .toHaveBeenCalledWith(translationUpsert('en', { title: 'Title', content: 'Body' }))
  })
})

describe('articleService.remove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 404 for a slug that does not exist', async () => {
    prisma.article.findUnique.mockResolvedValue(null)

    await expect(articleService.remove('nope')).rejects.toBeInstanceOf(NotFoundError)
    expect(prisma.article.delete).not.toHaveBeenCalled()
  })

  /**
   * Unlike a group there is nothing hanging off an article that somebody else owns, so there
   * is no `HAS_APPLICATIONS`-style refusal to make — the translations go with it through
   * `ON DELETE CASCADE`. The cost is a URL that was indexed and now 404s, which is why the
   * admin UI asks for a confirmation rather than the service refusing.
   */
  it('deletes by slug and says which one went', async () => {
    prisma.article.findUnique.mockResolvedValue(makeArticle({ slug: 'support-group' }))
    prisma.article.delete.mockResolvedValue(makeArticle())

    await expect(articleService.remove('support-group')).resolves.toEqual({ slug: 'support-group' })
    expect(prisma.article.delete).toHaveBeenCalledWith({ where: { slug: 'support-group' } })
  })
})

describe('articleService reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts and pages the published list in one go', async () => {
    prisma.article.findMany.mockResolvedValue([makeArticle()])
    prisma.article.count.mockResolvedValue(1)

    await expect(articleService.getPublishedList('ua', { skip: 10, take: 10 }))
      .resolves.toEqual({ articles: [expect.objectContaining({ id: 'article-1' })], total: 1 })

    expect(prisma.article.findMany.mock.calls[0]?.[0]).toMatchObject({ skip: 10, take: 10 })
  })

  /**
   * The home page block is the top of the archive: same order and same tie-break as the
   * paginated list, and no count beside it, because a block that renders what it gets has no
   * use for the size of the whole table.
   */
  it('reads the latest headlines in archive order without counting them', async () => {
    prisma.article.findMany.mockResolvedValue([])

    await articleService.getLatestHeadlines('en')

    expect(prisma.article.findMany.mock.calls[0]?.[0]).toMatchObject({
      take: ARTICLE_LIMITS.HOME_TEASER_COUNT,
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null },
        translations: { some: { locale: 'en' } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    })
    expect(prisma.article.count).not.toHaveBeenCalled()
  })

  /**
   * No body and no byline leave the database: the block renders a date and a linked title,
   * and pulling `content` would have the busiest page on the site parse six markdown
   * documents to throw them away.
   */
  it('selects only the fields the home page block renders', async () => {
    prisma.article.findMany.mockResolvedValue([])

    await articleService.getLatestHeadlines('ua')

    const call = prisma.article.findMany.mock.calls[0]?.[0]
    expect(call.select.translations.select).toEqual({ title: true })
    expect(JSON.stringify(call.select)).not.toContain('content')
    expect(call.include).toBeUndefined()
  })

  it('takes the headline count from the caller when one is given', async () => {
    prisma.article.findMany.mockResolvedValue([])

    await articleService.getLatestHeadlines('ua', 3)

    expect(prisma.article.findMany.mock.calls[0]?.[0].take).toBe(3)
  })

  it('throws 404 when an admin asks for a slug that is not there', async () => {
    prisma.article.findUnique.mockResolvedValue(null)

    await expect(articleService.getForAdmin('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('narrows the admin list to one status when asked', async () => {
    prisma.article.findMany.mockResolvedValue([])
    prisma.article.count.mockResolvedValue(0)

    await articleService.listForAdmin({ status: 'PUBLISHED', skip: 0, take: 20 })

    expect(prisma.article.findMany.mock.calls[0]?.[0].where).toEqual({ status: 'PUBLISHED' })
  })

  it('asks for every status when no filter is given', async () => {
    prisma.article.findMany.mockResolvedValue([])
    prisma.article.count.mockResolvedValue(0)

    await articleService.listForAdmin()

    expect(prisma.article.findMany.mock.calls[0]?.[0].where).toEqual({})
  })
})
