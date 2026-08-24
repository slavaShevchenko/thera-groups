import type { Role, User } from '@prisma/client'
import { prisma } from './prisma'
import { createServerClient } from './supabase'

export async function getUser(event: H3Event): Promise<User | null> {
  const supabase = createServerClient(event)

  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { organizerProfile: true },
  })

  return user
}

export async function requireAuth(event: H3Event): Promise<User> {
  const user = await getUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return user
}

export async function requireRole(event: H3Event, roles: Role[]): Promise<User> {
  const user = await requireAuth(event)

  if (!roles.includes(user.role as Role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  return user
}
