import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ServerEnv } from '~~/server/utils/config'

const { RESOLVED_SECRET } = vi.hoisted(() => ({ RESOLVED_SECRET: '0x4AAAAAAA-resolved' }))

// `$fetch` and `useRuntimeConfig` are Nitro auto-imports in server/utils/turnstile.ts, so
// neither is reachable through `vi.stubGlobal` — the transform binds them at import time.
// Mocking the shared resolver is what lets the default secret path be asserted at all.
vi.mock('~~/server/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/config')>()

  return {
    ...actual,
    resolveServerEnv: vi.fn(() => ({ turnstileSecretKey: RESOLVED_SECRET }) as unknown as ServerEnv),
  }
})

// eslint-disable-next-line import/first -- the import must follow vi.mock()
import { requireTurnstileToken, verifyTurnstileToken } from '~~/server/utils/turnstile'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SECRET = '0x4AAAAAAA-injected'

let fetchMock: ReturnType<typeof vi.fn>
let deps: { secretKey: string, fetcher: typeof fetchMock }

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ success: true })
  // Rebuilt per test: `fetchMock` is a fresh function each time, and a module-level `deps`
  // would keep handing out the first one.
  deps = { secretKey: SECRET, fetcher: fetchMock }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function sentBody(): { secret?: string, response?: string } {
  return fetchMock.mock.calls[0]?.[1]?.body ?? {}
}

describe('verifyTurnstileToken', () => {
  // The regression this suite exists for: `resolveEnvValue` takes the runtimeConfig value
  // first and the environment *name* second. Called with only the name, it handed the name
  // back as the secret — so production sent Cloudflare the literal string
  // 'TURNSTILE_SECRET_KEY' and every real token was rejected. `config.test.ts` asserts the
  // other half: that the resolver reads the variable it names.
  it('posts the resolved secret under `secret` and the token under `response`', async () => {
    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(VERIFY_URL, {
      method: 'POST',
      body: { secret: SECRET, response: 'a-token' },
    })
  })

  it('takes the secret from the shared server config when none is injected', async () => {
    await verifyTurnstileToken('a-token', { fetcher: fetchMock })

    expect(sentBody().secret).toBe(RESOLVED_SECRET)
    expect(sentBody().secret).not.toBe('TURNSTILE_SECRET_KEY')
  })

  it('accepts only an explicit success', async () => {
    fetchMock.mockResolvedValue({ success: 'true' })

    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(false)
  })

  // Cloudflare spells the reasons `error-codes`. Reading them as `errorCodes` left the field
  // permanently undefined, so a rejection was undiagnosable from the log.
  it('reports the rejection reason Cloudflare sent', async () => {
    fetchMock.mockResolvedValue({ 'success': false, 'error-codes': ['invalid-input-response'] })

    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid-input-response'),
    )
  })

  it('still says so when Cloudflare gives no reason', async () => {
    fetchMock.mockResolvedValue({ success: false })

    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no reason given'))
  })

  // The payload is raw `readBody` output when the check runs, so the token can be anything
  // a caller chose to send. None of these are worth a round-trip.
  it.each([
    ['an empty string', ''],
    ['a number', 12345],
    ['an object', { toString: () => 'a-token' }],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s without calling Cloudflare', async (_label, token) => {
    await expect(verifyTurnstileToken(token, deps)).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when Cloudflare is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'))

    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  // Cloudflare answers **400** for a malformed secret, and `$fetch` throws on a non-2xx —
  // so the reason arrives on the error, not on a response body. This is the case the
  // wrong-arity secret produced, and logging only the exception hid it.
  it('names invalid-input-secret when Cloudflare rejects the secret itself', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('Bad Request'), {
      response: { status: 400 },
      data: { 'success': false, 'error-codes': ['invalid-input-secret'] },
    }))

    await expect(verifyTurnstileToken('a-token', deps)).resolves.toBe(false)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('invalid-input-secret'),
      expect.anything(),
    )
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 400'),
      expect.anything(),
    )
  })

  describe('with no secret configured', () => {
    const noSecret = () => ({ secretKey: '', fetcher: fetchMock })

    it('skips verification in dev, where .env.example leaves the keys commented out', async () => {
      await expect(verifyTurnstileToken('a-token', noSecret())).resolves.toBe(true)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects in production, where an unconfigured check must not become an open door', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      await expect(verifyTurnstileToken('a-token', noSecret())).resolves.toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})

describe('requireTurnstileToken', () => {
  it('passes a token Cloudflare accepts', async () => {
    await expect(requireTurnstileToken({ turnstileToken: 'a-token' }, deps)).resolves.toBeUndefined()
  })

  it('rejects a token Cloudflare refuses', async () => {
    fetchMock.mockResolvedValue({ 'success': false, 'error-codes': ['invalid-input-response'] })

    await expect(
      requireTurnstileToken({ turnstileToken: 'a-token' }, deps),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Spam check failed',
      data: { code: 'VALIDATION_FAILED' },
    })
  })

  // Dropping the field has to be the harder path, not the easier one: without this the check
  // would be opt-in, and any client could skip it by omitting one property.
  it('rejects a missing token in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(requireTurnstileToken({}, deps)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Spam check required',
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tolerates a missing token in dev, so a checkout without keys can still submit', async () => {
    await expect(requireTurnstileToken({}, deps)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tolerates a body that never arrived', async () => {
    await expect(requireTurnstileToken(null, deps)).resolves.toBeUndefined()
  })

  it('rejects a non-string token rather than forwarding it', async () => {
    await expect(
      requireTurnstileToken({ turnstileToken: { nested: true } }, deps),
    ).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
