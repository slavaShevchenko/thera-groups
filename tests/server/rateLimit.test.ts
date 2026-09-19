import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent, getRequestIP } from 'h3'

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    getRequestIP: vi.fn(),
  }
})

// eslint-disable-next-line import/first -- import must follow vi.mock()
import { useRateLimiter } from '../../server/utils/rateLimit'

const mockGetRequestIP = vi.mocked(getRequestIP)

function makeEvent(ip: string) {
  return createEvent({ url: '/test', method: 'GET', headers: { 'x-forwarded-for': ip } }, {})
}

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auth limiter', () => {
    it('allows requests within the limit (5 per 15 min)', async () => {
      const ip = '10.0.0.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 5; i++) {
        await expect(useRateLimiter(makeEvent(ip), 'auth')).resolves.not.toThrow()
      }
    })

    it('throws 429 after 5 requests from same IP', async () => {
      const ip = '10.0.1.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 5; i++) {
        await useRateLimiter(makeEvent(ip), 'auth')
      }

      await expect(
        useRateLimiter(makeEvent(ip), 'auth'),
      ).rejects.toMatchObject({ statusCode: 429 })
    })
  })

  describe('register limiter', () => {
    it('allows requests within the limit (3 per hour)', async () => {
      const ip = '10.0.2.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 3; i++) {
        await expect(useRateLimiter(makeEvent(ip), 'register')).resolves.not.toThrow()
      }
    })

    it('throws 429 after 3 requests from same IP', async () => {
      const ip = '10.0.3.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 3; i++) {
        await useRateLimiter(makeEvent(ip), 'register')
      }

      await expect(
        useRateLimiter(makeEvent(ip), 'register'),
      ).rejects.toMatchObject({ statusCode: 429 })
    })
  })

  describe('IP independence', () => {
    it('different IPs do not affect each other', async () => {
      const ip1 = '10.0.4.1'
      const ip2 = '10.0.4.2'

      mockGetRequestIP.mockReturnValue(ip1)
      for (let i = 0; i < 5; i++) {
        await useRateLimiter(makeEvent(ip1), 'auth')
      }

      mockGetRequestIP.mockReturnValue(ip2)
      await expect(useRateLimiter(makeEvent(ip2), 'auth')).resolves.not.toThrow()
    })
  })

  describe('window reset', () => {
    it('allows requests again after duration expires', async () => {
      vi.useFakeTimers()

      const ip = '10.0.5.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 5; i++) {
        await useRateLimiter(makeEvent(ip), 'auth')
      }

      await expect(
        useRateLimiter(makeEvent(ip), 'auth'),
      ).rejects.toMatchObject({ statusCode: 429 })

      vi.advanceTimersByTime(16 * 60 * 1000)

      await expect(useRateLimiter(makeEvent(ip), 'auth')).resolves.not.toThrow()
    })
  })

  describe('error message', () => {
    it('includes retry time in seconds', async () => {
      const ip = '10.0.6.1'
      mockGetRequestIP.mockReturnValue(ip)

      for (let i = 0; i < 5; i++) {
        await useRateLimiter(makeEvent(ip), 'auth')
      }

      try {
        await useRateLimiter(makeEvent(ip), 'auth')
        expect.unreachable('should have thrown')
      }
      catch (error) {
        const err = error as { statusCode: number, statusMessage: string }
        expect(err.statusCode).toBe(429)
        expect(err.statusMessage).toMatch(/Too many requests/)
        expect(err.statusMessage).toMatch(/Try again in \d+ seconds/)
      }
    })
  })
})
