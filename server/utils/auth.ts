import type { H3Event } from 'h3'
import type { Role, User } from '@prisma/client'
import { prisma } from './prisma'
import { createServerClient } from './supabase'

export async function getUser(event: H3Event): Promise<User | null> {
  const supabase = createServerClient(event)

  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) {
    // eslint-disable-next-line no-console
    console.log('[getUser] no auth user:', error?.message)
    return null
  }

  // eslint-disable-next-line no-console
  console.log('[getUser] auth user found:', authUser.id, authUser.email)

  let user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { organizerProfile: true },
  })

  if (!user && authUser.email) {
    // eslint-disable-next-line no-console
    console.log('[getUser] prisma user not found, creating...')
    user = await prisma.user.create({
      data: {
        authId: authUser.id,
        email: authUser.email,
        role: 'VISITOR',
      },
      include: { organizerProfile: true },
    })
    // eslint-disable-next-line no-console
    console.log('[getUser] created user:', user.id)
  }
  else if (user) {
    // eslint-disable-next-line no-console
    console.log('[getUser] prisma user found:', user.id)
  }

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
