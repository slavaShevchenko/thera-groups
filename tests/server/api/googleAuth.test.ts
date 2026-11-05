import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent, getResponseHeader } from 'h3'

const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth?state=supabase'

const { supabaseAuth, adminAuth } = vi.hoisted(() => ({
  supabaseAuth: {
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    // `endRefusedSession` signs the refused identity out again, so the session cookies the
    // exchange wrote cannot reach `getUser()` — which auto-provisions a VISITOR row for a
    // session no local row answers to — on the visitor's next request.
    signOut: vi.fn(),
  },
  // `clearRefusedSignup` reaches for the service-role client to undo the GoTrue row the
  // code exchange just wrote.
  adminAuth: {
    deleteUser: vi.fn(),
  },
}))

vi.mock('~~/server/utils/supabase', () => ({
  createServerClient: () => ({ auth: supabaseAuth }),
  createAdminClient: () => ({ auth: { admin: adminAuth } }),
}))

vi.mock('~~/server/utils/rateLimit', () => ({
  useRateLimiter: vi.fn(),
  authLimiter: {},
}))

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

/**
 * The deployment's `SITE_URL`, mutable so the suite can be a production domain and a dev
 * checkout in turn. `useServerConfig()` reads Nitro's runtime config, which does not exist
 * outside a server, so only that one function is replaced — `isLocalhostUrl()` stays real
 * because the origin rule under test is built on it.
 */
const siteUrl = vi.hoisted(() => ({ value: 'https://psygroup.org' }))

vi.mock('~~/server/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/config')>()

  return { ...actual, useServerConfig: () => ({ siteUrl: siteUrl.value }) }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

const mockSignInWithOAuth = vi.mocked(supabaseAuth.signInWithOAuth)
const mockExchange = vi.mocked(supabaseAuth.exchangeCodeForSession)
const mockSignOut = vi.mocked(supabaseAuth.signOut)
const mockDeleteAuthUser = vi.mocked(adminAuth.deleteUser)

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

function makeGetEvent(url: string, host = 'localhost:3000') {
  return createEvent({ url, method: 'GET', headers: { host } }, makeRes() as never)
}

function makePostEvent(body: unknown) {
  const event = createEvent({
    url: '/api/auth/google',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }, makeRes() as never)
  event._requestBody = JSON.stringify(body)
  return event
}

async function googleStart(url: string, host?: string) {
  const mod = await import('../../../server/api/auth/google-start.get')
  const handler = mod.default as unknown as (_event: unknown) => Promise<{ url: string }>
  const event = makeGetEvent(url, host)
  const result = await handler(event)
  return { result, setCookie: getResponseHeader(event, 'set-cookie') }
}

async function googleComplete(body: unknown) {
  const mod = await import('../../../server/api/auth/google.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(makePostEvent(body))
}

function googleSession(metadata: Record<string, unknown> = {}) {
  return {
    error: null,
    data: { user: { id: 'auth-1', email: 'new@gmail.com', user_metadata: metadata } },
  }
}

/**
 * The row the OAuth handler resolves against.
 *
 * `google.post.ts` reads `public.User` twice — by `authId`, then by `email` for the link
 * check, then by `authId` again — and each read has to see what the previous write did. A
 * flat `mockResolvedValue` cannot express that: it answers every lookup the same way, so a
 * handler that repaired an address and then failed to find the row it repaired looks
 * identical to one that worked.
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
  siteUrl.value = 'https://psygroup.org'

  mockSignInWithOAuth.mockResolvedValue({ data: { url: OAUTH_URL }, error: null } as never)
  mockExchange.mockResolvedValue(googleSession({ given_name: 'Olena', family_name: 'Kovalenko' }) as never)
  mockDeleteAuthUser.mockResolvedValue({ data: null, error: null } as never)
  mockSignOut.mockResolvedValue({ error: null } as never)

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
})

describe('GET /api/auth/google-start', () => {
  it('builds the callback URL for the requested locale', async () => {
    const { result } = await googleStart('/api/auth/google-start?locale=ua')

    expect(result.url).toBe(OAUTH_URL)
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://psygroup.org/ua/auth/callback' },
    })
  })

  it('defaults the locale rather than failing a start that carried none', async () => {
    await googleStart('/api/auth/google-start')

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://psygroup.org/ua/auth/callback' },
    })
  })

  /**
   * There used to be a `role` here, carried across the redirect in an httpOnly cookie so a
   * Google sign-up could also open a PENDING organizer profile. It is gone: a provider
   * supplies an address and sometimes a name, which is not enough for a profile an admin
   * can verify. Nothing may be set on the response, and a stray `role` decides nothing.
   */
  it('sets no cookie and ignores a role left over in an old link', async () => {
    const { setCookie } = await googleStart('/api/auth/google-start?locale=en&role=organizer')

    expect(setCookie).toBeUndefined()
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://psygroup.org/en/auth/callback' },
    })
  })

  // The regression this guards: a redirectTo built from the request's own host is whatever
  // hostname reached the function, and Supabase answers a redirectTo outside its allowlist
  // by sending the browser to the project's Site URL instead — `http://localhost:3000` on a
  // project nobody reconfigured. A production sign-in then ends on the developer's machine.
  it('redirects to SITE_URL, not to the host the request arrived on', async () => {
    await googleStart('/api/auth/google-start?locale=ua', 'group-thera-git-main.vercel.app')

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://psygroup.org/ua/auth/callback' },
    })
  })

  it('strips a trailing slash from SITE_URL rather than doubling it in the callback', async () => {
    siteUrl.value = 'https://psygroup.org/'

    await googleStart('/api/auth/google-start?locale=ua')

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://psygroup.org/ua/auth/callback' },
    })
  })

  // Dev is the one place the request origin still decides: SITE_URL there is
  // nuxt.config.ts's fallback rather than a configured public origin, and a checkout on
  // another port or a LAN address has to be able to sign in to itself.
  it('falls back to the request origin while SITE_URL is the localhost fallback', async () => {
    siteUrl.value = 'http://localhost:3000'

    await googleStart('/api/auth/google-start?locale=en', '192.168.1.20:3001')

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://192.168.1.20:3001/en/auth/callback' },
    })
  })

  it('rejects a locale that would leave the Supabase redirect allowlist', async () => {
    await expect(googleStart('/api/auth/google-start?locale=../../evil')).rejects.toMatchObject({
      statusCode: 400,
    })

    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/google', () => {
  it('signs in the account the provider identity already belongs to', async () => {
    seedUser({ id: 'user-9', role: 'ORGANIZER' })

    const result = await googleComplete({ code: 'oauth-code' }) as {
      success: boolean
      user: { id: string }
    }

    expect(result).toMatchObject({ success: true, user: { id: 'user-9' } })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  /**
   * The rule this suite exists to pin: Google signs an account in, it never creates one.
   *
   * It used to create both a `User` and — with `role=organizer` — a PENDING profile built
   * from nothing but `given_name` and `family_name`, which some accounts do not even
   * supply. That profile reached the moderation queue missing every field
   * `moderateProfile` checks, so it could never be approved while its owner had been told
   * it was under review. 404 is what the callback page turns into "register first".
   */
  it('refuses an identity with no local account and creates nothing', async () => {
    await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(users).toHaveLength(0)
  })

  /**
   * The code exchange signs the identity in to GoTrue and writes its session cookies whether
   * or not this handler accepts the result, so every refusal has to undo what it can.
   * `getUser()` auto-provisions a `VISITOR` row for any session it can resolve, which makes
   * the cookies the dangerous half for both refusals; the 404 also deletes the GoTrue row,
   * because `register.post.ts` refuses to clear an orphan carrying a social identity and the
   * row would otherwise block the very registration the 404 points the visitor at.
   */
  describe('cleaning up the sign-in it refused', () => {
    it('deletes the GoTrue row the exchange wrote before answering 404', async () => {
      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({ statusCode: 404 })

      expect(mockDeleteAuthUser).toHaveBeenCalledWith('auth-1')
    })

    it('signs the refused session out so it cannot auto-provision a VISITOR', async () => {
      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({ statusCode: 404 })

      expect(mockSignOut).toHaveBeenCalled()
    })

    it('still answers 404 when the cleanup itself fails', async () => {
      // A provider failure here must not turn a correct refusal into a 500: the visitor's
      // instruction is the same either way, and a retry can only produce the same row.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockDeleteAuthUser.mockResolvedValue({ data: null, error: { message: 'GoTrue down' } } as never)
      mockSignOut.mockResolvedValue({ error: { message: 'GoTrue down' } } as never)

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 404,
        data: { code: 'NOT_FOUND' },
      })

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('deletes nothing when the sign-in succeeded', async () => {
      seedUser({ id: 'user-9' })

      await googleComplete({ code: 'oauth-code' })

      expect(mockDeleteAuthUser).not.toHaveBeenCalled()
      expect(mockSignOut).not.toHaveBeenCalled()
    })

    it('keeps the GoTrue row but ends the session when it refused on a provider conflict', async () => {
      // There *is* an account behind this address, under a different identity, so that
      // identity's GoTrue row belongs to a real sign-in path and must survive. The session
      // must not: it resolves to no row of its own, so `getUser()` would try to create one
      // and die on the unique `email` — a 409 on every public page this browser opens next.
      seedUser({ id: 'user-other', authId: 'auth-password', email: 'new@gmail.com' })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({ statusCode: 409 })

      expect(mockSignOut).toHaveBeenCalled()
      expect(mockDeleteAuthUser).not.toHaveBeenCalled()
    })

    it('still answers 409 when ending the conflicted session fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      seedUser({ id: 'user-other', authId: 'auth-password', email: 'new@gmail.com' })
      mockSignOut.mockResolvedValue({ error: { message: 'GoTrue down' } } as never)

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'CONFLICT' },
      })

      expect(mockDeleteAuthUser).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('deletes nothing when it refused a deactivated account', async () => {
      seedUser({ id: 'user-9', isActive: false })

      await expect(googleComplete({ code: 'oauth-code' })).rejects.toMatchObject({ statusCode: 403 })

      expect(mockDeleteAuthUser).not.toHaveBeenCalled()
      expect(mockSignOut).not.toHaveBeenCalled()
    })
  })

  it('opens no organizer profile for an account that has none', async () => {
    // A Google visitor with an account used to be one cookie away from a PENDING profile.
    seedUser({ id: 'user-9', role: 'VISITOR', organizerProfile: null })

    await googleComplete({ code: 'oauth-code' })

    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('leaves an existing organizer role and profile alone', async () => {
    seedUser({
      id: 'user-9',
      role: 'ORGANIZER',
      organizerProfile: { id: 'profile-9', verificationStatus: 'VERIFIED' },
    })

    await googleComplete({ code: 'oauth-code' })

    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
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

      const result = await googleComplete({ code: 'oauth-code' }) as {
        user: { id: string, email: string }
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
      // with no `authId` is an existing account meeting Google, not somebody else's. This
      // is the path that makes "register with a password, then sign in with Google" work.
      seedUser({ id: 'user-9', authId: null, email: 'new@gmail.com', role: 'VISITOR' })

      const result = await googleComplete({ code: 'oauth-code' }) as { user: { id: string } }

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-9' },
        data: { authId: 'auth-1' },
      })
      expect(prisma.user.create).not.toHaveBeenCalled()
      // Linked, not promoted: the role is the one the account already had.
      expect(result.user).toMatchObject({ id: 'user-9' })
      expect(users).toHaveLength(1)
    })

    it('leaves an already-linked account alone', async () => {
      seedUser({ id: 'user-9', authId: 'auth-1', email: 'new@gmail.com' })

      await googleComplete({ code: 'oauth-code' })

      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('returns 409 rather than adopting an address held by a different auth identity', async () => {
      // Somebody registered this address with a password *and* has since linked another
      // Google identity to it. Merging would hand this caller their applications and
      // groups, and signing them in as that user is the account takeover the 409 prevents.
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

    it('still refuses a deactivated account reached by a repaired address', async () => {
      // The check has to sit after resolution: deactivating an organizer while their
      // Google session stays valid must not let them back in.
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

    it('matches a mixed-case provider address to the normalized stored one', async () => {
      // GoTrue folds case; `User.email` is unique byte-for-byte. Without `normalizeEmail`
      // on the way in, this lookup misses and the identity reads as brand new — a 404 for
      // an account that exists.
      seedUser({ id: 'user-9', authId: null, email: 'mixed.case@gmail.com' })
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

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-9' },
        data: { authId: 'auth-1' },
      })
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('never hands the browser an authId or a rejection reason', async () => {
      seedUser({
        id: 'user-9',
        authId: 'auth-1',
        email: 'new@gmail.com',
        role: 'ORGANIZER',
        organizerProfile: { id: 'profile-9', verificationStatus: 'REJECTED' },
      })

      const result = await googleComplete({ code: 'oauth-code' })
      const body = JSON.stringify(result)

      expect(body).not.toContain('authId')
      expect(body).not.toContain('auth-1')
      expect(body).not.toContain('rejectionReason')
    })
  })
})
