import type { H3Event } from 'h3'
import { requireAuth } from '../../utils/auth'
import { createAdminClient } from '../../utils/supabase'
import { useServerConfig } from '../../utils/config'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { useRateLimiter, uploadLimiter } from '../../utils/rateLimit'
import { validateMagicBytes } from '../../utils/fileValidation'
import { AVATAR_LIMITS } from '~~/shared/constants/limits'

/**
 * Read from `shared/constants/limits.ts`, which `AvatarUploader.vue` reads too: the browser
 * refuses a file before it is ever sent, so the two numbers are one promise and a drift
 * between them is a user-visible lie. See `AVATAR_LIMITS` for why the ceiling is 4 MiB and
 * not the 5 MiB it used to be.
 */
const { MAX_FILE_BYTES: MAX_SIZE, MAX_BODY_BYTES: MAX_BODY_SIZE, ALLOWED_TYPES } = AVATAR_LIMITS

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Reads the request body without ever holding more than MAX_BODY_SIZE of it.
 *
 * `readMultipartFormData()` buffers the entire body before parsing, and the `content-length`
 * check in the handler cannot stop that: a request sent with `Transfer-Encoding: chunked`
 * carries no `content-length` at all, so the header reads as 0 and an arbitrarily large
 * upload is buffered whole. Nitro has no route rule for this — its `routeRules` accept
 * `cache`, `headers`, `redirect`, `prerender`, `proxy`, `isr`, `cors`, `swr` and `static`,
 * and nothing that limits a body — so the count happens here instead.
 *
 * Over the ceiling the reader keeps draining but stops accumulating. Cancelling it would be
 * tidier and is unsafe: h3's Node stream adapter registers its `data` listener in `start()`
 * with no `cancel` hook, so abandoning the reader leaves that listener enqueueing into a
 * closed controller and throws inside the request. Draining costs bandwidth, which the
 * platform bounds; accumulating costs memory, which nothing else bounds.
 *
 * The `<ArrayBuffer>` in the return type is not decoration: `event._requestBody` is typed
 * `BodyInit`, whose `BufferSource` member is `ArrayBufferView<ArrayBuffer>`, so the default
 * `Buffer<ArrayBufferLike>` is rejected by the compiler even though it is the same object at
 * runtime. `Buffer.concat()` already returns the narrower type.
 */
async function readBodyWithCeiling(event: H3Event): Promise<Buffer<ArrayBuffer>> {
  const stream = getRequestWebStream(event)
  if (!stream) return Buffer.alloc(0)

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let overCeiling = false

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    received += value.byteLength

    if (received > MAX_BODY_SIZE) {
      overCeiling = true
      continue
    }

    chunks.push(value)
  }

  if (overCeiling) {
    throw apiError(413, ErrorCodes.VALIDATION_FAILED, 'File too large')
  }

  return Buffer.concat(chunks)
}

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, uploadLimiter)

  // `requireAuth` rather than a hand-rolled 401: it is the same check every other
  // protected endpoint runs, and it is the one that also refuses an account deactivated
  // while its session cookie is still valid.
  const user = await requireAuth(event)

  const profile = await organizerRepository.findByUserId(user.id)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer profile not found')
  }

  // First of two size checks, and the cheap one: when a client does send `content-length`,
  // an oversized upload is refused before a single byte is read. It is not sufficient on
  // its own — see `readBodyWithCeiling` for the chunked case.
  const contentLength = parseInt(getHeader(event, 'content-length') || '0', 10)
  if (contentLength > MAX_BODY_SIZE) {
    throw apiError(413, ErrorCodes.VALIDATION_FAILED, 'File too large')
  }

  // Handed back to h3 through the field `readRawBody()` consults first, so
  // `readMultipartFormData()` parses the bytes already counted here instead of trying to
  // read a stream this function has drained.
  event._requestBody = await readBodyWithCeiling(event)

  const formData = await readMultipartFormData(event)
  const file = formData?.find(f => f.name === 'file')

  if (!file) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'File is required (field name: "file")')
  }

  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  // The file itself, now that the framing is stripped: the body ceiling above is the whole
  // request, and a full-size image inside 256 KiB of extra fields would still be over it.
  if (file.data.length > MAX_SIZE) {
    throw apiError(413, ErrorCodes.VALIDATION_FAILED, 'File too large')
  }

  if (!validateMagicBytes(file.data, file.type as string)) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid file content')
  }

  const ext = EXT_MAP[file.type as string] || 'jpg'
  const filePath = `${user.id}-${Date.now()}.${ext}`

  const adminClient = createAdminClient()
  // Resolved per request rather than hardcoded: no migration creates this bucket, so a
  // freshly provisioned Supabase project has to be able to name the one it does have.
  const bucket = useServerConfig().storageBucketOrganizerAvatars

  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(filePath, file.data, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw apiError(500, ErrorCodes.INTERNAL, 'Failed to upload avatar', undefined, uploadError)
  }

  const { data: { publicUrl } } = adminClient.storage
    .from(bucket)
    .getPublicUrl(filePath)

  const oldAvatarUrl = profile.avatarUrl
  const profileId = profile.id
  if (!profileId) {
    throw apiError(500, ErrorCodes.INTERNAL, 'Invalid organizer profile')
  }

  await organizerRepository.update(profileId, { avatarUrl: publicUrl })

  if (oldAvatarUrl) {
    const oldPath = oldAvatarUrl.split(`/${bucket}/`)[1]
    if (oldPath) {
      adminClient.storage
        .from(bucket)
        .remove([oldPath])
        .catch(err => console.warn('Failed to delete old avatar:', err))
    }
  }

  return { avatarUrl: publicUrl }
})
