import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createError, createEvent, send, setResponseHeaders, setResponseStatus } from 'h3'
import {
  findPrismaError,
  isLogged,
  isPrismaError,
  isUnhandledDomainFailure,
  isUnhandledPrismaFailure,
  logCapturedError,
  logHandlerError,
  mapPrismaError,
  sanitizeError,
  toHttpError,
} from '~~/server/utils/errorHandler'
import { findDomainError, mapDomainError, toDomainHttpError } from '~~/server/utils/mapDomainError'
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '~~/server/utils/domainErrors'
import nitroErrorHandler from '~~/server/utils/nitroErrorHandler'

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    send: vi.fn(async () => {}),
    setResponseHeaders: vi.fn(),
    setResponseStatus: vi.fn(),
  }
})

function makeEvent(url: string) {
  return createEvent({ url, method: 'GET', headers: {} }, {})
}

function prismaError(code: string, message = `Prisma failure ${code}`, meta?: { target?: string[] }) {
  return Object.assign(new Error(message), { code, ...(meta ? { meta } : {}) })
}

describe('logHandlerError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an expected 401 from a handler at warn level under that handler name', () => {
    const error = createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
      data: { code: 'UNAUTHORIZED' },
    })

    logHandlerError(error, { source: 'register', event: makeEvent('/api/auth/register') })

    expect(warnSpy).toHaveBeenCalledWith(
      '[register] 401 Invalid credentials path=/api/auth/register',
    )
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs a 500 from a handler at error level and keeps the error object', () => {
    const failure = new Error('Connection terminated unexpectedly')

    logHandlerError(failure, { source: 'register', event: makeEvent('/api/auth/register') })

    expect(errorSpy).toHaveBeenCalledWith(
      '[register] 500 Connection terminated unexpectedly path=/api/auth/register',
      failure,
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('logs a rate limit rejection from the limiter as a warning', () => {
    const error = createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { code: 'RATE_LIMITED' },
    })

    logHandlerError(error, { source: 'rateLimit', event: makeEvent('/api/groups') })

    expect(warnSpy).toHaveBeenCalledWith('[rateLimit] 429 Too many requests path=/api/groups')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('puts the Prisma code on the log line so dev logs stay diagnosable', () => {
    const mapped = mapPrismaError(prismaError('P2021', 'The table does not exist'), 'groups')

    logHandlerError(mapped, { source: 'groups', event: makeEvent('/api/admin/groups') })

    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      '[groups] 500 Internal server error path=/api/admin/groups prisma=P2021',
    )
  })

  it('finds the Prisma code through the cause chain h3 leaves behind', () => {
    const wrapped = createError(prismaError('P1001', 'Can\'t reach database server'))

    logHandlerError(wrapped, { source: 'unhandled', event: makeEvent('/api/groups') })

    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      '[unhandled] 500 Can\'t reach database server path=/api/groups prisma=P1001',
    )
  })

  it('omits the prisma= suffix for failures that are not driver errors', () => {
    logHandlerError(new Error('Renderer exploded'), { source: 'unhandled', event: makeEvent('/ua') })

    expect(errorSpy.mock.calls[0]?.[0]).toBe('[unhandled] 500 Renderer exploded path=/ua')
  })

  it('marks the error so the Nitro hook does not log it a second time', () => {
    const error = createError({ statusCode: 409, statusMessage: 'Duplicate', data: { code: 'CONFLICT' } })

    expect(isLogged(error)).toBe(false)
    logHandlerError(error, { source: 'register' })
    expect(isLogged(error)).toBe(true)
  })
})

describe('sanitizeError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the status and message of a trusted code and logs it once as a warning', () => {
    const error = createError({
      statusCode: 409,
      statusMessage: 'email already exists',
      data: { code: 'CONFLICT', field: 'email' },
    })

    const sanitized = sanitizeError(error, 'register')

    expect(sanitized.statusCode).toBe(409)
    expect(sanitized.statusMessage).toBe('email already exists')
    expect(sanitized.data).toEqual({ code: 'CONFLICT', field: 'email' })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('[register] 409 email already exists path=unknown')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('lets a 503 DATABASE_UNAVAILABLE through to the client as a retryable failure', () => {
    const error = createError({
      statusCode: 503,
      statusMessage: 'Database temporarily unavailable',
      data: { code: 'DATABASE_UNAVAILABLE' },
    })

    const sanitized = sanitizeError(error, 'groups.get')

    expect(sanitized.statusCode).toBe(503)
    expect(sanitized.data).toEqual({ code: 'DATABASE_UNAVAILABLE' })
  })

  it('replaces an untrusted code with a generic message and INTERNAL', () => {
    const error = createError({
      statusCode: 403,
      statusMessage: 'Some co-organizer users are not valid active organizers',
      data: { code: 'COORGANIZER_INVALID' },
    })

    const sanitized = sanitizeError(error, 'groups.patch')

    expect(sanitized.statusCode).toBe(403)
    expect(sanitized.statusMessage).toBe('Request failed')
    expect(sanitized.data).toEqual({ code: 'INTERNAL' })
  })

  // INTERNAL is on the whitelist because clients really do receive it — the fallback above
  // emits it for anything untrusted, and AGENTS.md §4 documents it as client-visible. It is
  // trusted as a *code* only: INTERNAL is exactly what a handler reaches for when it has an
  // internal diagnostic to name, and that sentence is for the log line, not a browser.
  it('trusts INTERNAL as a code but strips the handler message that came with it', () => {
    const error = createError({
      statusCode: 500,
      statusMessage: 'Failed to upload avatar',
      data: { code: 'INTERNAL' },
    })

    const sanitized = sanitizeError(error, 'avatar.post')

    expect(sanitized.statusCode).toBe(500)
    expect(sanitized.data).toEqual({ code: 'INTERNAL' })
    expect(sanitized.statusMessage).toBe('Request failed')
  })

  it('still logs what it stripped, so the operator gets what the client may not', () => {
    const error = createError({
      statusCode: 500,
      statusMessage: 'Failed to upload avatar',
      data: { code: 'INTERNAL' },
    })

    sanitizeError(error, 'avatar.post')

    expect(errorSpy).toHaveBeenCalledWith(
      '[avatar.post] 500 Failed to upload avatar path=unknown',
      expect.anything(),
    )
  })

  it('turns a non-HTTP error into a 500 INTERNAL and logs it at error level', () => {
    const sanitized = sanitizeError(new Error('boom'), 'register')

    expect(sanitized.statusCode).toBe(500)
    expect(sanitized.data).toEqual({ code: 'INTERNAL' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('marks the returned error so the Nitro hook stays silent', () => {
    const sanitized = sanitizeError(
      createError({ statusCode: 400, statusMessage: 'Bad', data: { code: 'VALIDATION_FAILED' } }),
      'register',
    )

    expect(isLogged(sanitized)).toBe(true)
  })
})

describe('mapPrismaError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps a unique constraint violation to 409 CONFLICT with the offending field', () => {
    const mapped = mapPrismaError(
      prismaError('P2002', 'Unique constraint failed', { target: ['groupId', 'email'] }),
      'applications.apply',
    )

    expect(mapped.statusCode).toBe(409)
    expect(mapped.data).toEqual({ code: 'CONFLICT', field: 'groupId' })
  })

  it('maps a missing record to 404 NOT_FOUND', () => {
    const mapped = mapPrismaError(prismaError('P2025'), 'groups.delete')

    expect(mapped.statusCode).toBe(404)
    expect(mapped.data).toEqual({ code: 'NOT_FOUND' })
  })

  it.each(['P2003', 'P2014'])('maps %s to 400 VALIDATION_FAILED', (code) => {
    const mapped = mapPrismaError(prismaError(code), 'groups.post')

    expect(mapped.statusCode).toBe(400)
    expect(mapped.data).toEqual({ code: 'VALIDATION_FAILED' })
  })

  it.each(['P1001', 'P1002', 'P1003', 'P5003'])(
    'maps %s to a retryable 503 DATABASE_UNAVAILABLE',
    (code) => {
      const mapped = mapPrismaError(
        prismaError(code, `Can't reach database server (${code})`),
        'groups.get',
      )

      expect(mapped.statusCode).toBe(503)
      expect(mapped.data).toEqual({ code: 'DATABASE_UNAVAILABLE' })
    },
  )

  it('maps a pool timeout to 503 SERVICE_BUSY', () => {
    const mapped = mapPrismaError(prismaError('P2024'), 'groups.get')

    expect(mapped.statusCode).toBe(503)
    expect(mapped.data).toEqual({ code: 'SERVICE_BUSY' })
  })

  it.each(['P2021', 'P2022', 'P2023'])(
    'maps schema drift %s to 500 INTERNAL while keeping the P-code as the cause',
    (code) => {
      const raw = prismaError(code, `The table \`public.Group\` does not exist (${code})`)

      const mapped = mapPrismaError(raw, 'groups.get')

      expect(mapped.statusCode).toBe(500)
      expect(mapped.data).toEqual({ code: 'INTERNAL' })
      expect(mapped.statusMessage).toBe('Internal server error')
      expect(mapped.cause).toBe(raw)
    },
  )

  it('maps an unknown P-code to 500 INTERNAL and keeps the raw error as the cause', () => {
    const raw = prismaError('P2999', 'Something Prisma did not document')

    const mapped = mapPrismaError(raw, 'groups.get')

    expect(mapped.statusCode).toBe(500)
    expect(mapped.data).toEqual({ code: 'INTERNAL' })
    expect(mapped.cause).toBe(raw)
  })

  it('is pure — it never logs, because the Nitro hook logs what the handler throws', () => {
    mapPrismaError(prismaError('P1001'), 'groups.get')

    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('leaves the mapped error unmarked so the Nitro hook still logs it once', () => {
    expect(isLogged(mapPrismaError(prismaError('P1001'), 'groups.get'))).toBe(false)
  })

  it('passes an already-shaped H3Error through sanitizeError instead of masking it', () => {
    const forbidden = createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      data: { code: 'FORBIDDEN' },
    })

    const mapped = mapPrismaError(forbidden, 'groups.delete')

    expect(mapped.statusCode).toBe(403)
    expect(mapped.data).toEqual({ code: 'FORBIDDEN' })
  })
})

describe('isPrismaError', () => {
  it('recognises a four-digit P-code and nothing else', () => {
    expect(isPrismaError(prismaError('P1001'))).toBe(true)
    expect(isPrismaError({ code: 'P2002' })).toBe(true)
    expect(isPrismaError({ code: 'P20' })).toBe(false)
    expect(isPrismaError({ code: 'ECONNREFUSED' })).toBe(false)
    expect(isPrismaError(createError({ statusCode: 404 }))).toBe(false)
    expect(isPrismaError(null)).toBe(false)
    expect(isPrismaError('P1001')).toBe(false)
  })
})

describe('findPrismaError', () => {
  it('finds a P-code on the error itself', () => {
    expect(findPrismaError(prismaError('P1001'))?.code).toBe('P1001')
  })

  it('unwraps the h3 H3Error, which drops `code` and keeps the driver error as cause', () => {
    // This is the exact shape Nitro's onError receives: h3 re-wraps anything a
    // handler threw, copying message/stack/data/statusCode but not `code`.
    const wrapped = createError(prismaError('P1001', 'Can\'t reach database server'))

    expect((wrapped as unknown as { code?: string }).code).toBeUndefined()
    expect(wrapped.statusCode).toBe(500)
    expect(findPrismaError(wrapped)?.code).toBe('P1001')
  })

  it('returns null when there is no Prisma error anywhere in the chain', () => {
    expect(findPrismaError(new Error('plain'))).toBeNull()
    expect(findPrismaError(createError(new Error('plain')))).toBeNull()
    expect(findPrismaError(null)).toBeNull()
  })
})

describe('isUnhandledPrismaFailure', () => {
  it('is true for a driver failure nobody shaped', () => {
    expect(isUnhandledPrismaFailure(createError(prismaError('P1001')))).toBe(true)
    expect(isUnhandledPrismaFailure(prismaError('P2021'))).toBe(true)
  })

  it('is false when a handler already chose the status, even with a Prisma cause', () => {
    const deliberate = mapPrismaError(prismaError('P2002', 'Unique', { target: ['email'] }), 'register')

    expect(deliberate.statusCode).toBe(409)
    expect(isUnhandledPrismaFailure(deliberate)).toBe(false)
  })

  it('is false for a non-Prisma failure', () => {
    expect(isUnhandledPrismaFailure(createError(new Error('renderer exploded')))).toBe(false)
  })
})

describe('findDomainError', () => {
  it('finds a DomainError h3 wrapped, where only `cause` survives', () => {
    const original = new NotFoundError('Group not found')

    expect(findDomainError(createError(original))).toBe(original)
  })

  it('returns null when there is no DomainError anywhere in the chain', () => {
    expect(findDomainError(new Error('plain'))).toBeNull()
    expect(findDomainError(createError(prismaError('P2025')))).toBeNull()
    expect(findDomainError(null)).toBeNull()
  })
})

describe('toDomainHttpError', () => {
  it('maps each domain error onto its HTTP status and code', () => {
    expect(toDomainHttpError(new NotFoundError('gone'))).toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
    expect(toDomainHttpError(new ForbiddenError())).toMatchObject({
      statusCode: 403,
      data: { code: 'FORBIDDEN' },
    })
    expect(toDomainHttpError(new ConflictError())).toMatchObject({
      statusCode: 409,
      data: { code: 'CONFLICT' },
    })
    expect(toDomainHttpError(new ValidationError('too short', 'title'))).toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED', field: 'title' },
    })
  })

  it('falls back to 400 for a bare DomainError with an unmapped code', () => {
    expect(toDomainHttpError(new DomainError('teapot', 'IM_A_TEAPOT'))).toMatchObject({
      statusCode: 400,
      data: { code: 'IM_A_TEAPOT' },
    })
  })

  // A service writes its message for a developer: it names the rule that broke and can quote
  // user input straight back (`Question "…" requires at least 2 options`), and none of it is
  // localized while every UI string goes through `t()`. So the wire carries a fixed phrase
  // per code, and clients keep branching on `data.code` exactly as before.
  it.each<[string, DomainError, string]>([
    ['Group not found', new NotFoundError('Group not found'), 'Not found'],
    [
      'Only admins can publish groups.',
      new ForbiddenError('Only admins can publish groups. Use PENDING_REVIEW instead.'),
      'Forbidden',
    ],
    [
      'Question "Why?" requires at least 2 options',
      new ValidationError('Question "Why?" requires at least 2 options', 'questions'),
      'Validation failed',
    ],
  ])('puts a fixed phrase on the wire instead of "%s"', (_message, domainError, expected) => {
    expect(toDomainHttpError(domainError)?.statusMessage).toBe(expected)
  })

  it('keeps the service message on cause, which is where the log line reads it from', () => {
    const domainError = new ValidationError(
      'Question "Why?" requires at least 2 options',
      'questions',
    )

    const mapped = toDomainHttpError(domainError)

    expect(mapped?.cause).toBe(domainError)
    expect(findDomainError(mapped)?.message).toBe('Question "Why?" requires at least 2 options')
  })

  it('uses the generic phrase for a code it has no wording for', () => {
    expect(toDomainHttpError(new DomainError('teapot', 'IM_A_TEAPOT'))?.statusMessage)
      .toBe('Request failed')
  })

  it('keeps the original reachable through cause', () => {
    const original = new NotFoundError('gone')

    expect(toDomainHttpError(createError(original))?.cause).toBe(original)
  })

  it('returns null for a non-domain failure', () => {
    expect(toDomainHttpError(new Error('plain'))).toBeNull()
  })
})

describe('mapDomainError', () => {
  it('throws the mapped HTTP error', () => {
    expect(() => mapDomainError(new NotFoundError('gone'))).toThrowError(
      expect.objectContaining({ statusCode: 404 }),
    )
  })

  it('rethrows anything that is not a DomainError', () => {
    const plain = new Error('plain')

    expect(() => mapDomainError(plain)).toThrow(plain)
  })
})

describe('isUnhandledDomainFailure', () => {
  it('is true for a service error nobody shaped', () => {
    expect(isUnhandledDomainFailure(createError(new NotFoundError('gone')))).toBe(true)
    expect(isUnhandledDomainFailure(new ForbiddenError())).toBe(true)
  })

  it('is false once a handler called mapDomainError itself', () => {
    let mapped: unknown
    try {
      mapDomainError(new NotFoundError('gone'))
    }
    catch (error) {
      mapped = error
    }

    expect(mapped).toMatchObject({ statusCode: 404 })
    expect(isUnhandledDomainFailure(mapped)).toBe(false)
  })

  it('is false for a non-domain failure', () => {
    expect(isUnhandledDomainFailure(createError(new Error('renderer exploded')))).toBe(false)
  })
})

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

  it('logs a raw Prisma failure under the status the client will actually receive', () => {
    const raw = prismaError('P1001', 'Invalid `prisma.group.findMany()` invocation:\n\nCan\'t reach database server')

    logCapturedError(raw, { event: makeEvent('/api/groups') })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      '[unhandled] 503 Database temporarily unavailable path=/api/groups prisma=P1001',
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('leaves a non-Prisma failure untouched', () => {
    const failure = new Error('Renderer exploded')

    logCapturedError(failure, { event: makeEvent('/ua/catalog') })

    expect(errorSpy).toHaveBeenCalledWith(
      '[unhandled] 500 Renderer exploded path=/ua/catalog',
      failure,
    )
  })

  it('logs an uncaught domain failure as the 4xx warn the client receives', () => {
    logCapturedError(createError(new NotFoundError('Group not found')), { event: makeEvent('/api/groups/x') })

    expect(warnSpy).toHaveBeenCalledWith('[unhandled] 404 Group not found path=/api/groups/x')
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('toHttpError', () => {
  it('maps Prisma failures and passes everything else through', () => {
    const mapped = toHttpError(prismaError('P2025')) as { statusCode: number }
    const plain = new Error('plain')

    expect(mapped.statusCode).toBe(404)
    expect(toHttpError(plain)).toBe(plain)
  })

  it('maps an uncaught domain failure onto its own status', () => {
    const mapped = toHttpError(createError(new ForbiddenError())) as { statusCode: number, data: { code: string } }

    expect(mapped.statusCode).toBe(403)
    expect(mapped.data.code).toBe('FORBIDDEN')
  })
})

describe('nitroErrorHandler', () => {
  const defaultHandler = vi.fn()

  beforeEach(() => {
    vi.mocked(send).mockClear()
    vi.mocked(setResponseStatus).mockClear()
    vi.mocked(setResponseHeaders).mockClear()
    defaultHandler.mockReset()
    defaultHandler.mockResolvedValue({
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
      body: {
        error: true,
        statusCode: 503,
        statusMessage: 'Database temporarily unavailable',
        message: 'Database temporarily unavailable',
        data: { code: 'DATABASE_UNAVAILABLE' },
      },
    })
  })

  it('maps an uncaught Prisma failure on an API route and sends the response itself', async () => {
    const raw = prismaError('P1001', 'Can\'t reach database server at 127.0.0.1:5433')
    const event = makeEvent('/api/groups')

    await nitroErrorHandler(raw as never, event, { defaultHandler })

    const mapped = defaultHandler.mock.calls[0]?.[0]
    expect(mapped.statusCode).toBe(503)
    expect(mapped.data).toEqual({ code: 'DATABASE_UNAVAILABLE' })
    expect(mapped.cause).toBe(raw)

    expect(setResponseHeaders).toHaveBeenCalledWith(event, { 'content-type': 'application/json' })
    expect(setResponseStatus).toHaveBeenCalledWith(event, 503, 'Service Unavailable')
    expect(send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(send).mock.calls[0]?.[1] as string).data.code)
      .toBe('DATABASE_UNAVAILABLE')
  })

  it('leaves a non-Prisma failure to the built-in handler', async () => {
    await nitroErrorHandler(new Error('boom') as never, makeEvent('/api/groups'), { defaultHandler })

    expect(defaultHandler).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('leaves an already-mapped H3Error to the built-in handler', async () => {
    const error = createError({ statusCode: 404, data: { code: 'NOT_FOUND' } })

    await nitroErrorHandler(error, makeEvent('/api/groups/missing'), { defaultHandler })

    expect(defaultHandler).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('does not answer a page route with JSON, so SSR still renders the error page', async () => {
    await nitroErrorHandler(prismaError('P1001') as never, makeEvent('/ua/catalog'), { defaultHandler })

    expect(defaultHandler).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('maps the h3-wrapped shape Nitro actually delivers, where `code` only survives as cause', async () => {
    const wrapped = createError(prismaError('P1001', 'Can\'t reach database server at 127.0.0.1:5433'))
    const event = makeEvent('/api/groups')

    await nitroErrorHandler(wrapped, event, { defaultHandler })

    const mapped = defaultHandler.mock.calls[0]?.[0]
    expect(mapped.statusCode).toBe(503)
    expect(mapped.data).toEqual({ code: 'DATABASE_UNAVAILABLE' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('maps an uncaught DomainError on an API route, which most handlers never catch', async () => {
    defaultHandler.mockResolvedValueOnce({
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      body: { error: true, statusCode: 404, data: { code: 'NOT_FOUND' } },
    })

    const wrapped = createError(new NotFoundError('Group not found'))
    const event = makeEvent('/api/admin/organizer-profiles/missing')

    await nitroErrorHandler(wrapped, event, { defaultHandler })

    const mapped = defaultHandler.mock.calls[0]?.[0]
    expect(mapped.statusCode).toBe(404)
    expect(mapped.data).toEqual({ code: 'NOT_FOUND' })
    expect(setResponseStatus).toHaveBeenCalledWith(event, 404, 'Not Found')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not override a status a handler already chose', async () => {
    const deliberate = mapPrismaError(
      prismaError('P2002', 'Unique constraint failed', { target: ['email'] }),
      'register',
    )

    await nitroErrorHandler(deliberate as never, makeEvent('/api/auth/register'), { defaultHandler })

    expect(defaultHandler).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
