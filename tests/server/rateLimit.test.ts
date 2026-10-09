import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'

const { mockConsume, mockGet } = vi.hoisted(() => ({
  mockConsume: vi.fn(),
  mockGet: vi.fn(),
}))

vi.mock('~~/server/utils/dbConnection', () => ({
  createDbConnectionConfig: vi.fn().mockReturnValue({
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'test',
    database: 'test',
    ssl: {},
  }),
}))

vi.mock('pg', () => {
  function MockPool() {
    return {
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
    }
  }
  return { default: { Pool: MockPool }, Pool: MockPool }
})

vi.mock('rate-limiter-flexible', () => {
  function MockRateLimiterPostgres(opts: { keyPrefix: string }) {
    this.keyPrefix = opts.keyPrefix
    this.consume = mockConsume
    this.get = mockGet
  }
  return { RateLimiterPostgres: MockRateLimiterPostgres }
})

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { useRateLimiter, useEmailRateLimiter, getClientIP, emailRateLimitKey, authLimiter, registerLimiter } from '../../server/utils/rateLimit'

function makeEvent(headers: Record<string, string> = {}) {
  return createEvent({ url: '/test', method: 'GET', headers }, {})
}

describe('getClientIP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TRUSTED_PROXY_HOPS
  })

  // The header is client-writable. Trusting it first meant one `curl -H 'X-Real-IP: …'`
  // per attempt moved every attempt into a fresh bucket, so the login and register
  // limiters never fired no matter how many guesses an attacker made.
  it('ignores x-real-ip entirely, even when it is the only header', () => {
    const event = makeEvent({ 'x-real-ip': '1.2.3.4' })
    expect(getClientIP(event)).toBe('unknown')
  })

  it('does not let a spoofed x-real-ip override the forwarded chain', () => {
    const event = makeEvent({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '203.0.113.5' })
    expect(getClientIP(event)).toBe('203.0.113.5')
  })

  it('returns last non-private IP from x-forwarded-for', () => {
    const event = makeEvent({ 'x-forwarded-for': '10.0.0.1, 203.0.113.5, 10.0.0.2' })
    expect(getClientIP(event)).toBe('203.0.113.5')
  })

  it('falls back to last IP when all are private', () => {
    const event = makeEvent({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1' })
    expect(getClientIP(event)).toBe('192.168.1.1')
  })

  it('ignores spoofed private IP prepended by attacker', () => {
    const event = makeEvent({ 'x-forwarded-for': '10.0.0.1, 203.0.113.50' })
    expect(getClientIP(event)).toBe('203.0.113.50')
  })

  it('reads the client as the right-most entry when nothing was prepended', () => {
    const event = makeEvent({ 'x-forwarded-for': '203.0.113.7' })
    expect(getClientIP(event)).toBe('203.0.113.7')
  })

  it('treats carrier-grade NAT and IPv6 unique-local ranges as infrastructure', () => {
    expect(getClientIP(makeEvent({ 'x-forwarded-for': '203.0.113.9, 100.64.0.1' }))).toBe('203.0.113.9')
    expect(getClientIP(makeEvent({ 'x-forwarded-for': '203.0.113.9, fd00::1' }))).toBe('203.0.113.9')
  })

  it('drops blank entries a trailing comma leaves behind', () => {
    const event = makeEvent({ 'x-forwarded-for': '203.0.113.11,,' })
    expect(getClientIP(event)).toBe('203.0.113.11')
  })

  it('returns unknown when no headers present', () => {
    const event = makeEvent()
    expect(getClientIP(event)).toBe('unknown')
  })

  describe('with TRUSTED_PROXY_HOPS configured', () => {
    afterEach(() => {
      delete process.env.TRUSTED_PROXY_HOPS
    })

    it('counts the declared hops back from the right instead of guessing', () => {
      process.env.TRUSTED_PROXY_HOPS = '1'
      const event = makeEvent({ 'x-forwarded-for': '198.51.100.4, 203.0.113.5, 10.0.0.2' })
      expect(getClientIP(event)).toBe('203.0.113.5')
    })

    it('takes the right-most entry when zero hops are declared, even if it is private', () => {
      process.env.TRUSTED_PROXY_HOPS = '0'
      const event = makeEvent({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' })
      expect(getClientIP(event)).toBe('10.0.0.2')
    })

    it('clamps a hop count larger than the header instead of reading past its start', () => {
      process.env.TRUSTED_PROXY_HOPS = '9'
      const event = makeEvent({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' })
      expect(getClientIP(event)).toBe('203.0.113.5')
    })

    it('ignores a value that is not a non-negative integer', () => {
      process.env.TRUSTED_PROXY_HOPS = 'many'
      const event = makeEvent({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' })
      expect(getClientIP(event)).toBe('203.0.113.5')
    })
  })
})

describe('emailRateLimitKey', () => {
  it('is stable across the spellings of one address', () => {
    expect(emailRateLimitKey('User@Example.COM')).toBe(emailRateLimitKey(' user@example.com '))
  })

  it('separates two different addresses', () => {
    expect(emailRateLimitKey('a@example.com')).not.toBe(emailRateLimitKey('b@example.com'))
  })

  it('carries no part of the address, which is stored in a plain table', () => {
    const key = emailRateLimitKey('olena.kovalenko@example.com')
    expect(key).toMatch(/^em:[0-9a-f]{32}$/)
    expect(key).not.toContain('olena')
    expect(key).not.toContain('example')
  })
})

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consumes a point under the client address and does not throw on success', async () => {
    mockConsume.mockResolvedValueOnce({ remainingPoints: 4 })
    const event = makeEvent({ 'x-forwarded-for': '1.2.3.4' })

    await expect(useRateLimiter(event, authLimiter)).resolves.not.toThrow()
    expect(mockConsume).toHaveBeenCalledWith('ip:1.2.3.4')
  })

  it('throws 429 with RATE_LIMITED code when limit exceeded', async () => {
    mockConsume.mockRejectedValueOnce({ msBeforeNext: 30000 })
    const event = makeEvent({ 'x-forwarded-for': '5.6.7.8' })

    await expect(useRateLimiter(event, authLimiter)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'Too many requests',
    })
  })

  it('includes retryAfter in error data', async () => {
    mockConsume.mockRejectedValueOnce({ msBeforeNext: 60000 })
    const event = makeEvent({ 'x-forwarded-for': '9.10.11.12' })

    try {
      await useRateLimiter(event, registerLimiter)
      expect.unreachable('should have thrown')
    }
    catch (error) {
      const err = error as { statusCode: number, data: { code: string, retryAfter: number } }
      expect(err.statusCode).toBe(429)
      expect(err.data.code).toBe('RATE_LIMITED')
      expect(err.data.retryAfter).toBe(60)
    }
  })

  it('does not let a spoofed x-real-ip move the attempt into a fresh bucket', async () => {
    mockConsume.mockResolvedValue({ remainingPoints: 4 })

    // Ten attempts, ten different spoofed values, one real address in the chain.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await useRateLimiter(
        makeEvent({ 'x-real-ip': `10.1.0.${attempt}`, 'x-forwarded-for': '203.0.113.5' }),
        authLimiter,
      )
    }

    const keys = mockConsume.mock.calls.map(call => call[0])
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe('ip:203.0.113.5')
  })
})

describe('useEmailRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gives one account its own bucket, whatever address it is reached from', async () => {
    mockConsume.mockResolvedValue({ remainingPoints: 4 })

    await useEmailRateLimiter(authLimiter, 'olena@example.com')

    expect(mockConsume).toHaveBeenCalledTimes(1)
    expect(mockConsume).toHaveBeenCalledWith(emailRateLimitKey('olena@example.com'))
  })

  it('keeps two accounts behind one address on separate budgets', async () => {
    mockConsume.mockResolvedValue({ remainingPoints: 4 })
    const event = makeEvent({ 'x-forwarded-for': '203.0.113.5' })

    await useRateLimiter(event, authLimiter)
    await useEmailRateLimiter(authLimiter, 'a@example.com')
    await useRateLimiter(event, authLimiter)
    await useEmailRateLimiter(authLimiter, 'b@example.com')

    expect(mockConsume.mock.calls.map(call => call[0])).toEqual([
      'ip:203.0.113.5',
      emailRateLimitKey('a@example.com'),
      'ip:203.0.113.5',
      emailRateLimitKey('b@example.com'),
    ])
  })

  it('throws 429 when the per-account budget is gone', async () => {
    mockConsume.mockRejectedValueOnce({ msBeforeNext: 900000 })

    await expect(useEmailRateLimiter(authLimiter, 'olena@example.com')).rejects.toMatchObject({
      statusCode: 429,
      data: { code: 'RATE_LIMITED', retryAfter: 900 },
    })
  })

  it('lets the request through when the store itself fails', async () => {
    // Rate limiting must not be able to take sign-in down when `rate_limits` is unreachable.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConsume.mockRejectedValueOnce(new Error('connection terminated'))

    await expect(useEmailRateLimiter(authLimiter, 'olena@example.com')).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
