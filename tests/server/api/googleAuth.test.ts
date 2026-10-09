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

beforeEach(() => {
  vi.clearAllMocks()

  mockSignInWithOAuth.mockResolvedValue({ data: { url: OAUTH_URL }, error: null } as never)
  mockExchange.mockResolvedValue(googleSession({ given_name: 'Olena', family_name: 'Kovalenko' }) as never)

  // `mockReset` first: a `mockResolvedValueOnce` queued here would still win the first
  // call in tests that stub their own existing user.
  prisma.user.findUnique.mockReset().mockResolvedValue(null)
  prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'user-1',
    isActive: true,
    preferredLocale: 'ua',
    organizerProfile: null,
    ...data,
  }))
  prisma.user.update.mockResolvedValue({ id: 'user-1', role: 'ORGANIZER' })
  prisma.organizerProfile.findUnique.mockResolvedValue(null)
  prisma.organizerProfile.create.mockResolvedValue({ id: 'profile-1', verificationStatus: 'PENDING' })
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
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'new@gmail.com',
      role: 'VISITOR',
      isActive: true,
      preferredLocale: 'ua',
      organizerProfile: null,
    })

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
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'new@gmail.com',
      role: 'ORGANIZER',
      isActive: true,
      preferredLocale: 'ua',
      organizerProfile: { id: 'profile-9', verificationStatus: 'PENDING' },
    })

    await googleComplete({ code: 'oauth-code' }, ORGANIZER_COOKIE)

    expect(prisma.organizerProfile.create).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('leaves an existing organizer role alone when the request says visitor', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'new@gmail.com',
      role: 'ORGANIZER',
      isActive: true,
      preferredLocale: 'ua',
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
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'new@gmail.com',
      role: 'VISITOR',
      isActive: false,
      organizerProfile: null,
    })

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
