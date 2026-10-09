import { requireAuth } from '../../utils/auth'
import { createAdminClient } from '../../utils/supabase'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'
import { useRateLimiter, uploadLimiter } from '../../utils/rateLimit'
import { validateMagicBytes } from '../../utils/fileValidation'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_SIZE = 5 * 1024 * 1024

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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

  const contentLength = parseInt(getHeader(event, 'content-length') || '0', 10)
  if (contentLength > MAX_SIZE) {
    throw apiError(413, ErrorCodes.VALIDATION_FAILED, 'File too large')
  }

  const formData = await readMultipartFormData(event)
  const file = formData?.find(f => f.name === 'file')

  if (!file) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'File is required (field name: "file")')
  }

  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  if (file.data.length > MAX_SIZE) {
    throw apiError(413, ErrorCodes.VALIDATION_FAILED, 'File too large')
  }

  if (!validateMagicBytes(file.data, file.type as string)) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Invalid file content')
  }

  const ext = EXT_MAP[file.type as string] || 'jpg'
  const filePath = `${user.id}-${Date.now()}.${ext}`

  const adminClient = createAdminClient()

  const { error: uploadError } = await adminClient.storage
    .from('organizer-avatars')
    .upload(filePath, file.data, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError.message)
    throw apiError(500, ErrorCodes.INTERNAL, 'Failed to upload avatar')
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('organizer-avatars')
    .getPublicUrl(filePath)

  const oldAvatarUrl = profile.avatarUrl
  const profileId = profile.id
  if (!profileId) {
    throw apiError(500, ErrorCodes.INTERNAL, 'Invalid organizer profile')
  }

  await organizerRepository.update(profileId, { avatarUrl: publicUrl })

  if (oldAvatarUrl) {
    const oldPath = oldAvatarUrl.split('/organizer-avatars/')[1]
    if (oldPath) {
      adminClient.storage
        .from('organizer-avatars')
        .remove([oldPath])
        .catch(err => console.warn('Failed to delete old avatar:', err))
    }
  }

  return { avatarUrl: publicUrl }
})
