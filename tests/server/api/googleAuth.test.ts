import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent, getResponseHeader } from 'h3'

const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth?state=supabase'

const { supabaseAuth } = vi.hoisted(() => ({
  supabaseAuth: {
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  },
}))

vi.mock('~~/server/utils/supabase', () => ({
  createServerClient: () => ({ auth: supabaseAuth }),
}))

vi.mock('~~/server/utils/rateLimit', () => ({
  useRateLimiter: vi.fn(),
  authLimiter: {},
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { setSignupRole, takeSignupRole } from '~~/server/utils/oauth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

const mockSignInWithOAuth = vi.mocked(supabaseAuth.signInWithOAuth)
const mockExchange = vi.mocked(supabaseAuth.exchangeCodeForSession)

const SIGNUP_ROLE_COOKIE = 'google_signup_role'

/**
 * h3's cookie helpers write through `event.node.res`, and `createEvent` accepts any object
 * there — so a stub that records headers is enough to assert what the handler set.
 */
function makeRes() {
  const headers = new Map<string, string | string[]>()

  return {
    statusCode: 200,
    headersSent: false,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    setHeader: (name: string, value: string | string[]) => headers.set(name.toLowerCase(), value),
    removeHeader: (name: string) => headers.delete(name.toLowerCase()),
    appendHeader: (name: string, value: string) => {
      const key = name.toLowerCase()
      const current = headers.get(key)
      headers.set(key, current === undefined ? value : [...[current].flat(), value])
    },
    getHeaders: () => Object.fromEntries(headers),
  }
}

function makeGetEvent(url: string) {
  return createEvent({ url, method: 'GET', headers: { host: 'localhost:3000' } }, makeRes() as never)
}

function makePostEvent(body: unknown, cookie?: string) {
  const event = createEvent({
    url: '/api/auth/google',
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  }, makeRes() as never)
  event._requestBody = JSON.stringify(body)
  return event
}

async function googleStart(url: string) {
  const mod = await import('../../../server/api/auth/google-start.get')
  const handler = mod.default as unknown as (_event: unknown) => Promise<{ url: string }>
  const event = makeGetEvent(url)
  const result = await handler(event)
  return { result, setCookie: getResponseHeader(event, 'set-cookie') }
}

async function googleComplete(body: unknown, cookie?: string) {
  const mod = await import('../../../server/api/auth/google.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  const event = makePostEvent(body, cookie)
  const result = await handler(event)
  return { result, setCookie: getResponseHeader(event, 'set-cookie') }
}

function googleSession(metadata: Record<string, unknown> = {}) {
  return {
    error: null,
    data: { user: { id: 'auth-1', email: 'new@gmail.com', user_metadata: metadata } },
  }
}

const ORGANIZER_COOKIE = `${SIGNUP_ROLE_COOKIE}=organizer`

/**
 * The row the OAuth handler resolves against.
 *
 * `google.post.ts` reads `public.User` three different ways — by `authId`, by `email` for
 * the link check, and by `authId` again after it writes — and each read has to see what
 * the previous write did. A flat `mockResolvedValue` cannot express that: it answers every
 * lookup the same way, so a handler that repaired an address and then failed to find the
 * row it repaired looks identical to one that worked.
 */
type StoredUser = {
  id: string
  authId: string | null
  email: string
  role: 'VISITOR' | 'ORGANIZER' | 'ADMIN'
  isActive: boolean
  preferredLocale: string
  organizerProfile: { id: string, verificationStatus: string } | null
}

let users: StoredUser[] = []

function seedUser(overrides: Partial<StoredUser> = {}): StoredUser {
  const user: StoredUser = {
    id: 'user-9',
    authId: 'auth-1',
    email: 'new@gmail.com',
    role: 'VISITOR',
    isActive: true,
    preferredLocale: 'ua',
    organizerProfile: null,
    ...overrides,
  }

  users.push(user)
  return user
}

/**
 * Answers a `findUnique` the way Prisma does: with only the columns the `select` asked for.
 *
 * Without this the mock returns the whole stored row, and a test asserting the response
 * carries no `authId` would pass for the wrong reason — or fail for one. Projecting means
 * the repository's own `select` is what is under test.
 */
function project(user: StoredUser, select?: Record<string, unknown>): Record<string, unknown> {
  if (!select) return { ...user }

  const row = user as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const key of Object.keys(select)) {
    if (key === 'organizerProfile') {
      const nested = select[key] as { select?: Record<string, unknown> } | true | undefined
      const nestedSelect = typeof nested === 'object' && nested !== null ? nested.select : undefined
      const profile = user.organizerProfile as unknown as Record<string, unknown> | null

      out[key] = profile && nestedSelect
        ? Object.fromEntries(Object.keys(nestedSelect).map(field => [field, profile[field]]))
        : profile

      continue
    }

    out[key] = row[key]
  }

  return out
}

beforeEach(() => {
  vi.clearAllMocks()

  users = []

  mockSignInWithOAuth.mockResolvedValue({ data: { url: OAUTH_URL }, error: null } as never)
  mockExchange.mockResolvedValue(googleSession({ given_name: 'Olena', family_name: 'Kovalenko' }) as never)

  prisma.user.findUnique.mockImplementation(
    async ({ where, select }: {
      where: { authId?: string, email?: string, id?: string }
      select?: Record<string, unknown>
    }) => {
      const match = users.find((user) => {
        if (where.authId !== undefined) return user.authId === where.authId
        if (where.email !== undefined) return user.email === where.email
        if (where.id !== undefined) return user.id === where.id
        return false
      })

      return match ? project(match, select) : null
    },
  )

  prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const created: StoredUser = {
      id: 'user-1',
      authId: 'auth-1',
      email: 'new@gmail.com',
      role: 'VISITOR',
      isActive: true,
      preferredLocale: 'ua',
      organizerProfile: null,
      ...data,
    } as StoredUser

    const taken = users.some(user => user.email === created.email || user.authId === created.authId)
    if (taken) {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      })
    }

    users.push(created)
    return { ...created }
  })

  prisma.user.update.mockImplementation(
    async ({ where, data }: { where: { id: string }, data: Record<string, unknown> }) => {
      const existing = users.find(user => user.id === where.id)
      if (!existing) throw Object.assign(new Error('not found'), { code: 'P2025' })

      // Postgres enforces `User.email @unique`; the handler's 409 branch is built on that
      // rejection, so the fake has to produce it too or the branch is never reached.
      if (typeof data.email === 'string') {
        const taken = users.some(user => user.id !== where.id && user.email === data.email)
        if (taken) {
          throw Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { target: ['email'] },
          })
        }
      }

      Object.assign(existing, data)
      return { ...existing }
    },
  )

  prisma.organizerProfile.findUnique.mockResolvedValue(null)
  prisma.organizerProfile.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      const profile = { id: 'profile-1', verificationStatus: 'PENDING', ...data }
      const owner = users.find(user => user.id === data.userId)
      if (owner) {
        owner.organizerProfile = {
          id: profile.id as string,
          verificationStatus: profile.verificationStatus as string,
        }
      }

      return profile
    },
  )
})

describe('GET /api/auth/google-start', () => {
  it('defaults to a visitor sign-in and says so in the cookie', async () => {
    const { result, setCookie } = await googleStart('/api/auth/google-start?locale=ua')

    expect(result.url).toBe(OAUTH_URL)
    expect(setCookie).toContain(`${SIGNUP_ROLE_COOKIE}=visitor`)
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/ua/auth/callback' },
    })
  })

  it('carries an explicit organizer choice to the callback', async () => {
    const { setCookie } = await googleStart('/api/auth/google-start?locale=en&role=organizer')

    expect(setCookie).toContain(`${SIGNUP_ROLE_COOKIE}=organizer`)
    expect(setCookie).toContain('HttpOnly')
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/en/auth/callback' },
    })
  })

  it('rejects an unknown role instead of guessing', async () => {
    await expect(googleStart('/api/auth/google-start?role=admin')).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })

    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })

  it('rejects a locale that would leave the Supabase redirect allowlist', async () => {
    await expect(googleStart('/api/auth/google-start?locale=../../evil')).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})

describe('POST /api/auth/google', () => {
  it('creates no organizer profile for a visitor, even with a name in the metadata', async () => {
    const { result } = await googleComplete({ code: 'oauth-code' })

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'VISITOR' }) }),
    )
    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true })
  })

  it('creates a PENDING profile and an ORGANIZER role when the visitor asked to organize', async () => {
    await googleComplete({ code: 'oauth-code' }, ORGANIZER_COOKIE)

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'ORGANIZER' }) }),
    )
    expect(prisma.organizerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        firstName: 'Olena',
        lastName: 'Kovalenko',
        verificationStatus: 'PENDING',
      }),
    })
  })

  it('upgrades an existing visitor who signs in asking to organize', async () => {
    seedUser({ id: 'user-9', role: 'VISITOR' })

    await googleComplete({ code: 'oauth-code' }, ORGANIZER_COOKIE)

    expect(prisma.organizerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-9', verificationStatus: 'PENDING' }),
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-9' },
      data: { role: 'ORGANIZER' },
    })
  })

  it('never creates a second profile for a repeated organizer sign-in', async () => {
    seedUser({
      id: 'user-9',
      role: 'ORGANIZER',
      organizerProfile: { id: 'profile-9', verificationStatus: 'PENDING' },
    })

    await googleComplete({ code: 'oauth-code' }, ORGANIZER_COOKIE)

    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('leaves an existing organizer role alone when the request says visitor', async () => {
    seedUser({
      id: 'user-9',
      role: 'ORGANIZER',
      organizerProfile: { id: 'profile-9', verificationStatus: 'VERIFIED' },
    })

    await googleComplete({ code: 'oauth-code' })

    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
  })

  it('consumes the role cookie so it cannot decide a later sign-in', async () => {
    const event = makePostEvent({ code: 'oauth-code' }, ORGANIZER_COOKIE)

    // The handler is what deletes it; drive it through the real cookie helper path.
    const mod = await import('../../../server/api/auth/google.post')
    await (mod.default as unknown as (_event: unknown) => Promise<unknown>)(event)

    expect(getResponseHeader(event, 'set-cookie')).toContain(`${SIGNUP_ROLE_COOKIE}=;`)
    expect(getResponseHeader(event, 'set-cookie')).toContain('Max-Age=0')
  })

  it('returns 400 without a code', async () => {
    await expect(googleComplete({})).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns 403 for a deactivated account', async () => {
    seedUser({ id: 'user-9', isActive: false })

    await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'FORBIDDEN' },
    })
  })

  it('returns 400 when the code exchange fails', async () => {
    mockExchange.mockResolvedValue({ data: null, error: { message: 'invalid code' } } as never)

    await expect(googleComplete({ code: 'bad' })).rejects.toMatchObject({ statusCode: 400 })

    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  /**
   * Resolution by `authId` first and by email second is what keeps a Google account whose
   * address changed from becoming a second, empty local account — and what stops two
   * accounts sharing one address from being silently merged into whichever signed in last.
   */
  describe('reconciling the provider identity with the local row', () => {
    it('repairs the stored address when the provider has since changed it', async () => {
      seedUser({ id: 'user-9', authId: 'auth-1', email: 'old@gmail.com', role: 'ORGANIZER' })

      const { result } = await googleComplete({ code: 'oauth-code' }) as {
        result: { user: { id: string, email: string } }
      }

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-9' },
        data: { email: 'new@gmail.com' },
      })
      // One account, not two: the row that was found is the row that was repaired.
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(result.user).toMatchObject({ id: 'user-9', email: 'new@gmail.com' })
      expect(users).toHaveLength(1)
    })

    it('links a password sign-up to its provider the first time they meet', async () => {
      // `authId` is nullable and a password registration never sets one, so an address
      // with no `authId` is an existing account meeting Google, not somebody else's.
      seedUser({ id: 'user-9', authId: null, email: 'new@gmail.com', role: 'VISITOR' })

      await googleComplete({ code: 'oauth-code' }, ORGANIZER_COOKIE)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-9' },
        data: { authId: 'auth-1' },
      })
      expect(prisma.user.create).not.toHaveBeenCalled()
      // The upgrade still lands on the row that existed, not on a fresh one.
      expect(prisma.organizerProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-9' }),
      })
      expect(users).toHaveLength(1)
    })

    it('leaves an already-linked account alone', async () => {
      seedUser({ id: 'user-9', authId: 'auth-1', email: 'new@gmail.com' })

      await googleComplete({ code: 'oauth-code' })

      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('returns 409 rather than adopting an address held by a different auth identity', async () => {
      // Somebody registered this address with a password. Merging would hand the Google
      // caller their applications and groups, and signing them in as that user is exactly
      // the account takeover the 409 exists to prevent.
      seedUser({ id: 'user-other', authId: 'auth-password', email: 'new@gmail.com', role: 'ORGANIZER' })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'CONFLICT' },
      })

      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('returns 409 when repairing the address would collide with another account', async () => {
      seedUser({ id: 'user-9', authId: 'auth-1', email: 'old@gmail.com' })
      seedUser({ id: 'user-other', authId: 'auth-password', email: 'new@gmail.com' })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'CONFLICT' },
      })
    })

    it('names the provider mismatch in the message, which is what the visitor can act on', async () => {
      seedUser({ id: 'user-other', authId: 'auth-password', email: 'new@gmail.com' })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusMessage: 'Account with this email exists under a different provider',
      })
    })

    it('stores the address normalized so the unique lookups can find it again', async () => {
      mockExchange.mockResolvedValue({
        error: null,
        data: {
          user: {
            id: 'auth-1',
            email: '  Mixed.Case@Gmail.COM ',
            user_metadata: { given_name: 'Olena', family_name: 'Kovalenko' },
          },
        },
      } as never)

      await googleComplete({ code: 'oauth-code' })

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'mixed.case@gmail.com' }),
        }),
      )
    })

    it('still refuses a deactivated account reached by a repaired address', async () => {
      // The check has to sit after resolution, not only on the create path: deactivating
      // an organizer while their Google session stays valid must not let them back in.
      seedUser({ id: 'user-9', authId: 'auth-1', email: 'old@gmail.com', isActive: false })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 403,
        data: { code: 'FORBIDDEN' },
      })

      expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    })

    it('refuses a deactivated account reached by a freshly linked address', async () => {
      seedUser({ id: 'user-9', authId: null, email: 'new@gmail.com', isActive: false })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('never hands the browser an authId or a rejection reason', async () => {
      seedUser({
        id: 'user-9',
        authId: 'auth-1',
        email: 'new@gmail.com',
        role: 'ORGANIZER',
        organizerProfile: { id: 'profile-9', verificationStatus: 'REJECTED' },
      })

      const { result } = await googleComplete({ code: 'oauth-code' }) as { result: unknown }
      const body = JSON.stringify(result)

      expect(body).not.toContain('authId')
      expect(body).not.toContain('auth-1')
      expect(body).not.toContain('rejectionReason')
    })
  })
})

describe('signup role cookie', () => {
  it('round-trips through a real h3 event and defaults to visitor', () => {
    const event = makeGetEvent('/api/auth/google-start')

    setSignupRole(event, 'organizer')
    expect(getResponseHeader(event, 'set-cookie')).toContain(`${SIGNUP_ROLE_COOKIE}=organizer`)

    // A request that never went through google-start is a visitor, not an organizer.
    expect(takeSignupRole(makeGetEvent('/api/auth/google-start'))).toBe('visitor')
  })
})
