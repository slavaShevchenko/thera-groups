import type { H3Event } from 'h3'
import type { Role, User } from '@prisma/client'
import { prisma } from './prisma'
import { createServerClient } from './supabase'

/**
 * Retrieves the currently authenticated user from the Supabase session.
 * Auto-creates a Prisma VISITOR record for valid Supabase auth users without one (e.g. OAuth edge cases).
 * @param event - The H3 request event
 * @returns The authenticated user with organizer profile, or null if not authenticated
 */
export async function getUser(event: H3Event): Promise<User | null> {
  const supabase = createServerClient(event)

  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  let user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { organizerProfile: true },
  })

  // Auto-create Prisma user for valid Supabase auth users without a record
  // (e.g. Google OAuth login-only, or edge cases)
  if (!user && authUser.email) {
    user = await prisma.user.create({
      data: {
        authId: authUser.id,
        email: authUser.email,
        role: 'VISITOR',
      },
      include: { organizerProfile: true },
    })
  }

  return user
}

/**
 * Ensures the request is authenticated, throwing a 401 error if not.
 * @param event - The H3 request event
 * @returns The authenticated user
 * @throws 401 error if no valid session exists
 */
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

/**
 * Ensures the authenticated user has one of the required roles.
 * @param event - The H3 request event
 * @param roles - Array of allowed roles (e.g. ['ADMIN', 'ORGANIZER'])
 * @returns The authenticated user if their role is in the allowed list
 * @throws 401 error if not authenticated, 403 error if role is not permitted
 */
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
