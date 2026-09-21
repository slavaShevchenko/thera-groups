import { describe, it, expect, vi, beforeEach } from 'vitest'
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
import { useRateLimiter, getClientIP, authLimiter, registerLimiter } from '../../server/utils/rateLimit'

function makeEvent(headers: Record<string, string> = {}) {
  return createEvent({ url: '/test', method: 'GET', headers }, {})
}

describe('getClientIP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns x-real-ip when present', () => {
    const event = makeEvent({ 'x-real-ip': '1.2.3.4' })
    expect(getClientIP(event)).toBe('1.2.3.4')
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

  it('returns unknown when no headers present', () => {
    const event = makeEvent()
    expect(getClientIP(event)).toBe('unknown')
  })
})

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consumes a point and does not throw on success', async () => {
    mockConsume.mockResolvedValueOnce({ remainingPoints: 4 })
    const event = makeEvent({ 'x-real-ip': '1.2.3.4' })

    await expect(useRateLimiter(event, authLimiter)).resolves.not.toThrow()
    expect(mockConsume).toHaveBeenCalledWith('1.2.3.4')
  })

  it('throws 429 with RATE_LIMITED code when limit exceeded', async () => {
    mockConsume.mockRejectedValueOnce({ msBeforeNext: 30000 })
    const event = makeEvent({ 'x-real-ip': '5.6.7.8' })

    await expect(useRateLimiter(event, authLimiter)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'Too many requests',
    })
  })

  it('includes retryAfter in error data', async () => {
    mockConsume.mockRejectedValueOnce({ msBeforeNext: 60000 })
    const event = makeEvent({ 'x-real-ip': '9.10.11.12' })

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
})
