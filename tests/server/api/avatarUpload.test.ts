import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'
import { AVATAR_LIMITS } from '~~/shared/constants/limits'

vi.mock('~~/server/utils/prisma', () => ({ prisma: globalThis.prisma }))

vi.mock('~~/server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

// The limiter is Postgres-backed; a unit test must never touch the rate-limit tables.
vi.mock('~~/server/utils/rateLimit', () => ({
  useRateLimiter: vi.fn(async () => {}),
  uploadLimiter: {},
}))

vi.mock('~~/server/utils/supabase', () => ({
  createAdminClient: vi.fn(),
}))

// Mocked rather than resolved for real: `useServerConfig()` reads Nitro's runtime config,
// which does not exist outside a server. The value asserted below is the point — the bucket
// is configuration now, not a string hardcoded in the handler.
vi.mock('~~/server/utils/config', () => ({
  useServerConfig: () => ({ storageBucketOrganizerAvatars: 'configured-bucket' }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globalThis.prisma is set in test setup
const prisma = globalThis.prisma as any

// eslint-disable-next-line import/first -- imports must follow vi.mock()
import { requireAuth } from '~~/server/utils/auth'

// eslint-disable-next-line import/first
import { createAdminClient } from '~~/server/utils/supabase'

const mockRequireAuth = vi.mocked(requireAuth)
const mockCreateAdminClient = vi.mocked(createAdminClient)

const BOUNDARY = '----vitestAvatarBoundary'
const MIB = 1024 * 1024
// Imported rather than restated: the whole point of `AVATAR_LIMITS` is that the browser, the
// handler and this suite read one number. A local copy here would keep passing after the
// handler's ceiling moved, which is exactly the drift the shared constant exists to prevent.
const MAX_SIZE = AVATAR_LIMITS.MAX_FILE_BYTES
const MAX_BODY_SIZE = AVATAR_LIMITS.MAX_BODY_BYTES

const storage = {
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
}
const from = vi.fn(() => storage)

/** A buffer whose first bytes are the JPEG signature `validateMagicBytes` looks for. */
function jpegBytes(length: number): Buffer {
  const bytes = Buffer.alloc(length, 0x41)
  Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).copy(bytes, 0)
  return bytes
}

function multipartBody(fileBytes: Buffer): Buffer {
  const head = Buffer.from(
    `--${BOUNDARY}\r\n`
    + 'Content-Disposition: form-data; name="file"; filename="avatar.jpg"\r\n'
    + 'Content-Type: image/jpeg\r\n\r\n',
  )

  return Buffer.concat([head, fileBytes, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)])
}

/**
 * An event carrying `body` as a web stream and no `content-length`, which is exactly the
 * shape a `Transfer-Encoding: chunked` upload arrives in.
 */
function makeChunkedEvent(body: Buffer | Buffer[]) {
  const chunks = Array.isArray(body) ? body : [body]
  let index = 0

  const event = createEvent({
    url: '/api/organizers/avatar',
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test only needs h3's event shape
  }, {} as any)

  event._requestBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new Uint8Array(chunks[index++]!))
        return
      }

      controller.close()
    },
  })

  return event
}

function makeSizedEvent(body: Buffer, contentLength: number) {
  return createEvent({
    url: '/api/organizers/avatar',
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      'content-length': String(contentLength),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test only needs h3's event shape
  }, {} as any)
}

async function callHandler(event: unknown) {
  const mod = await import('../../../server/api/organizers/avatar.post')
  const handler = mod.default as unknown as (_event: unknown) => Promise<unknown>
  return handler(event)
}

describe('POST /api/organizers/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      role: 'ORGANIZER',
      email: 'organizer@example.com',
    })
    prisma.organizerProfile.findUnique.mockResolvedValue({ id: 'profile-1', avatarUrl: null })
    prisma.organizerProfile.update.mockResolvedValue({ id: 'profile-1' })

    from.mockClear()
    storage.upload.mockResolvedValue({ error: null })
    storage.getPublicUrl.mockReturnValue({
      data: { publicUrl: `https://cdn.test/configured-bucket/user-1.jpg` },
    })
    storage.remove.mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({ storage: { from } })
  })

  // The platform ceiling both constants have to stay under. Vercel answers 413
  // FUNCTION_PAYLOAD_TOO_LARGE for a larger body *before the function runs*, on every plan
  // and with no setting that raises it — so a ceiling above it is unreachable in production
  // however correct the handler is, and the browser shows a generic failure for a file it
  // just declared acceptable. 4.5 MB read as MiB is the stricter of the two readings.
  it.each([
    ['the whole request body', MAX_BODY_SIZE],
    ['the file on its own', MAX_SIZE],
  ])('keeps %s within Vercel\'s 4.5 MB request body limit', (_label, bytes) => {
    expect(bytes).toBeLessThanOrEqual(4.5 * MIB)
  })

  it('uploads to the bucket named by configuration', async () => {
    const event = makeChunkedEvent(multipartBody(jpegBytes(2048)))

    await expect(callHandler(event)).resolves.toEqual({
      avatarUrl: 'https://cdn.test/configured-bucket/user-1.jpg',
    })

    // Upload, public URL and the removal of a previous avatar all have to name the same
    // bucket; a hardcoded string in any one of them would split avatars across two.
    expect(from).toHaveBeenCalled()
    expect(from.mock.calls.every(([name]) => name === 'configured-bucket')).toBe(true)
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })

  it('parses the body it counted itself, so the ceiling does not break a real upload', async () => {
    // The handler drains the stream and hands the buffer back through `event._requestBody`,
    // which is the field h3's `readRawBody` consults first. If that handoff ever stops
    // working, `readMultipartFormData` finds no file and this fails as a 400.
    const event = makeChunkedEvent(multipartBody(jpegBytes(4096)))

    await expect(callHandler(event)).resolves.toBeDefined()

    const [path, contents] = storage.upload.mock.calls[0]!
    expect(path).toMatch(/^user-1-\d+\.jpg$/)
    expect(contents.subarray(0, 3)).toEqual(Buffer.from([0xFF, 0xD8, 0xFF]))
  })

  it('refuses an oversized content-length before reading a single byte', async () => {
    // The stream errors itself on construction, so a handler that read the body would
    // reject with this message instead of the expected 413 — which is what makes "never
    // read" assertable rather than merely assumed.
    const event = makeChunkedEvent(jpegBytes(1024))
    event._requestBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('the body was read despite an oversized content-length'))
      },
    })
    event.node.req.headers['content-length'] = String(MAX_BODY_SIZE + 1)

    await expect(callHandler(event)).rejects.toMatchObject({
      statusCode: 413,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  // The gap the content-length check cannot close: a chunked request carries no
  // content-length at all, so the header reads as 0 and the whole body would be buffered.
  it('refuses a chunked body that crosses the ceiling, with no content-length to check', async () => {
    const oversized = Buffer.concat([
      multipartBody(jpegBytes(MAX_BODY_SIZE)),
      Buffer.alloc(1024, 0x41),
    ])

    const event = makeChunkedEvent(oversized)
    expect(event.node.req.headers['content-length']).toBeUndefined()

    await expect(callHandler(event)).rejects.toMatchObject({
      statusCode: 413,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('accepts a file at the limit, which is the upload a real client sends', async () => {
    const event = makeChunkedEvent(multipartBody(jpegBytes(MAX_SIZE - 1024)))

    await expect(callHandler(event)).resolves.toBeDefined()
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })

  // Why the body ceiling sits above the file limit rather than at it: the request also
  // carries multipart framing and any extra field, and counting those against the 5 MiB
  // the user was promised would refuse an image that is itself within it.
  it('leaves room in the ceiling for framing and an extra field', async () => {
    const file = jpegBytes(MAX_SIZE - 1024)
    const padding = Buffer.alloc(200 * 1024, 0x61)
    const body = Buffer.concat([
      multipartBody(file),
      Buffer.from(
        `--${BOUNDARY}\r\n`
        + 'Content-Disposition: form-data; name="note"\r\n\r\n',
      ),
      padding,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ])

    expect(body.length).toBeGreaterThan(MAX_SIZE)
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_SIZE)

    await expect(callHandler(makeChunkedEvent(body))).resolves.toBeDefined()
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })

  it('refuses a file over the limit even when the body stays under the ceiling', async () => {
    // The file check is not redundant with the ceiling: the ceiling bounds the request,
    // MAX_SIZE bounds the image, and the framing slack sits between them.
    const body = multipartBody(jpegBytes(MAX_SIZE + 1024))

    expect(body.length).toBeLessThanOrEqual(MAX_BODY_SIZE)

    await expect(callHandler(makeChunkedEvent(body))).rejects.toMatchObject({
      statusCode: 413,
      data: { code: 'VALIDATION_FAILED' },
    })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('removes the previous avatar from the same bucket', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      avatarUrl: 'https://cdn.test/configured-bucket/user-1-old.png',
    })

    const event = makeChunkedEvent(multipartBody(jpegBytes(2048)))

    await expect(callHandler(event)).resolves.toBeDefined()
    expect(storage.remove).toHaveBeenCalledWith(['user-1-old.png'])
  })

  it('answers 400 when no file field is present', async () => {
    const event = makeChunkedEvent(Buffer.from(`--${BOUNDARY}--\r\n`))

    await expect(callHandler(event)).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_FAILED' },
    })
  })

  it('answers 404 for a user with no organizer profile', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue(null)

    const event = makeSizedEvent(multipartBody(jpegBytes(2048)), 2048)

    await expect(callHandler(event)).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'NOT_FOUND' },
    })
    expect(storage.upload).not.toHaveBeenCalled()
  })
})
