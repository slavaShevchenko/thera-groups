import { getUser } from '../../utils/auth'
import { createAdminClient } from '../../utils/supabase'
import { prisma } from '../../utils/prisma'

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
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  })

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organizer profile not found',
    })
  }

  const formData = await readMultipartFormData(event)
  const file = formData?.find(f => f.name === 'file')

  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File is required (field name: "file")',
    })
  }

  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
    })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File too large. Maximum size: 5MB',
    })
  }

  const ext = EXT_MAP[file.type] || 'jpg'
  const path = `${user.id}-${Date.now()}.${ext}`

  const adminClient = createAdminClient()

  const { error: uploadError } = await adminClient.storage
    .from('organizer-avatars')
    .upload(path, file.data, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    // eslint-disable-next-line no-console
    console.error('Storage upload error:', uploadError.message)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload avatar',
    })
  }

  const { data: { publicUrl } } = adminClient.storage
    .from('organizer-avatars')
    .getPublicUrl(path)

  // Удаляем старый аватар из storage
  if (profile.avatarUrl) {
    const oldPath = profile.avatarUrl.split('/organizer-avatars/')[1]
    if (oldPath) {
      await adminClient.storage
        .from('organizer-avatars')
        .remove([oldPath])
        .catch(() => {})
    }
  }

  // Обновляем профиль
  await prisma.organizerProfile.update({
    where: { id: profile.id },
    data: { avatarUrl: publicUrl },
  })

  return { avatarUrl: publicUrl }
})
