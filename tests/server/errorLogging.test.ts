import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createError, createEvent } from 'h3'
import { logCapturedError } from '~~/server/utils/errorHandler'

function makeEvent(url: string) {
  return createEvent({ url, method: 'GET', headers: {} }, {})
}

describe('logCapturedError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an expected 401 as a warning with the real path and no error object', () => {
    const error = createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
      data: { code: 'UNAUTHORIZED' },
    })

    logCapturedError(error, { event: makeEvent('/api/auth/login') })

    expect(warnSpy).toHaveBeenCalledWith('[unhandled] 401 Invalid credentials path=/api/auth/login')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs an expected 404 as a warning with the real path', () => {
    const error = createError({ statusCode: 404, statusMessage: 'Group type not found' })

    logCapturedError(error, { event: makeEvent('/ua/catalog/nonexistent') })

    expect(warnSpy).toHaveBeenCalledWith('[unhandled] 404 Group type not found path=/ua/catalog/nonexistent')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs a rate limit rejection as a warning', () => {
    const error = createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { code: 'RATE_LIMITED' },
    })

    logCapturedError(error, { event: makeEvent('/api/groups') })

    expect(warnSpy).toHaveBeenCalledWith('[unhandled] 429 Too many requests path=/api/groups')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs a 5xx failure as an error and keeps the error object for the stack trace', () => {
    const failure = new Error('Connection terminated unexpectedly')

    logCapturedError(failure, { event: makeEvent('/api/groups') })

    expect(errorSpy).toHaveBeenCalledWith(
      '[unhandled] 500 Connection terminated unexpectedly path=/api/groups',
      failure,
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('treats an error outside a request as a 500 with an unknown path', () => {
    const failure = createError({ statusCode: 503, statusMessage: 'Upstream unavailable' })

    logCapturedError(failure, { tags: ['plugin'] })

    expect(errorSpy).toHaveBeenCalledWith('[unhandled] 503 Upstream unavailable path=unknown', failure)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('drops the query string so OAuth codes and tokens stay out of the logs', () => {
    const error = createError({ statusCode: 400, statusMessage: 'Invalid state' })

    logCapturedError(error, { event: makeEvent('/api/auth/google?code=secret-code&state=abc123') })

    expect(warnSpy).toHaveBeenCalledWith('[unhandled] 400 Invalid state path=/api/auth/google')
  })

  it('falls back to 500 when the error carries no status code', () => {
    logCapturedError({ message: 'Plain object thrown' }, { event: makeEvent('/api/health') })

    expect(errorSpy).toHaveBeenCalledWith(
      '[unhandled] 500 Plain object thrown path=/api/health',
      { message: 'Plain object thrown' },
    )
  })

  it('collapses a multi-line Prisma message onto one line so path= stays greppable', () => {
    const failure = new Error('Invalid prisma.group.findMany() invocation:\n\n\nCan\'t reach database server at 127.0.0.1:5433')

    logCapturedError(failure, { event: makeEvent('/api/groups') })

    expect(errorSpy).toHaveBeenCalledWith(
      '[unhandled] 500 Invalid prisma.group.findMany() invocation: Can\'t reach database server at 127.0.0.1:5433 path=/api/groups',
      failure,
    )
  })

  it('falls back to a placeholder when the error has no usable message', () => {
    logCapturedError(new Error('   '), { event: makeEvent('/api/groups') })

    expect(errorSpy.mock.calls[0]?.[0]).toBe('[unhandled] 500 Unknown error path=/api/groups')
  })
})
