import type { H3Event } from 'h3'
import type { Role, User } from '@prisma/client'
import { prisma } from './prisma'
import { createServerClient } from './supabase'
import { ErrorCodes } from './errorCodes'

export async function getUser(event: H3Event, options?: { withProfile?: boolean }): Promise<User | null> {
  const supabase = createServerClient(event)

  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  if (!authUser.email) {
    return null
  }

  const includeProfile = options?.withProfile ?? false

  const user = await prisma.user.upsert({
    where: { authId: authUser.id },
    update: {
      email: authUser.email,
    },
    create: {
      authId: authUser.id,
      email: authUser.email,
      role: 'VISITOR',
    },
    ...(includeProfile && { include: { organizerProfile: true } }),
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

  // Checked here rather than only at login: an account deactivated while its session
  // cookie is still valid must lose access to every protected endpoint immediately,
  // not at the next sign-in. The code stays FORBIDDEN because a bespoke
  // ACCOUNT_DEACTIVATED is not a trusted client code — sanitizeError() would flatten it
  // to a 500 INTERNAL and the client would lose the 403.
  if (!user.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account disabled',
      data: { code: ErrorCodes.FORBIDDEN },
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
