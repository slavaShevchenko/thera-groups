import { getUser } from '../../utils/auth'
import { createAdminClient } from '../../utils/supabase'
import { organizerRepository } from '../../repositories/organizerRepository'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export default defineEventHandler(async (event) => {
  const user = await getUser(event)

  if (!user) {
    throw apiError(401, ErrorCodes.UNAUTHORIZED, 'Unauthorized')
  }

  const profile = await organizerRepository.findByUserId(user.id)

  if (!profile) {
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Organizer profile not found')
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
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'File too large. Maximum size: 5MB')
  }

  const ext = (file.type && EXT_MAP[file.type]) || 'jpg'
  const path = `${user.id}-${Date.now()}.${ext}`

  const adminClient = createAdminClient()

  const { error: uploadError } = await adminClient.storage
    .from('organizer-avatars')
    .upload(path, file.data, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError.message)
    throw apiError(500, ErrorCodes.INTERNAL, 'Failed to upload avatar')
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('organizer-avatars')
    .getPublicUrl(path)

  // Delete old avatar from storage
  if (profile.avatarUrl) {
    const oldPath = profile.avatarUrl.split('/organizer-avatars/')[1]
    if (oldPath) {
      await adminClient.storage
        .from('organizer-avatars')
        .remove([oldPath])
        .catch(() => {})
    }
  }

  await organizerRepository.update(profile.id, { avatarUrl: publicUrl })

  return { avatarUrl: publicUrl }
})
