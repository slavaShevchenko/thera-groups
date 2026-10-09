import type { H3Event } from 'h3'
import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { createServerClient } from './supabase'
import { ErrorCodes } from './errorCodes'
import { findPrismaError } from './errorHandler'
import { normalizeEmail } from './emailAddress'

const isUniqueViolation = (error: unknown) => findPrismaError(error)?.code === 'P2002'

export async function getUser(event: H3Event, options?: { withProfile?: boolean }): Promise<User | null> {
  const supabase = createServerClient(event)

  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  if (!authUser.email) {
    return null
  }

  const email = normalizeEmail(authUser.email)
  const include = options?.withProfile
    ? { include: { organizerProfile: true } }
    : undefined

  // Read-first rather than an upsert on every request. The upsert wrote to `User` on each
  // authenticated call — including ones that only read — and two requests from a brand-new
  // session both took its `create` arm, so one of them lost on the unique `authId` and the
  // page failed with a 409 nobody could act on.
  const existing = await prisma.user.findUnique({
    where: { authId: authUser.id },
    ...include,
  })

  if (existing) {
    if (existing.email === email) return existing

    // The provider's address moved; keep the local row in step so the two cannot drift
    // apart. A collision means another local account already owns that address, which is
    // not ours to steal — the row this session belongs to is returned unchanged and the
    // desync surfaces on the OAuth path, which is the one that can resolve it explicitly.
    try {
      return await prisma.user.update({ where: { id: existing.id }, data: { email }, ...include })
    }
    catch (updateError) {
      if (isUniqueViolation(updateError)) return existing
      throw updateError
    }
  }

  try {
    return await prisma.user.create({
      data: { authId: authUser.id, email, role: 'VISITOR' },
      ...include,
    })
  }
  catch (createError) {
    if (!isUniqueViolation(createError)) throw createError

    // The losing half of the race above: the row exists now, so read it back.
    const raced = await prisma.user.findUnique({ where: { authId: authUser.id }, ...include })
    if (raced) return raced

    // Unique on `email`, not on `authId`: the address belongs to a different auth identity.
    // Linking those is a decision with security consequences and belongs to the OAuth
    // handler, not to a middleware-time read, so it is left to fail loudly.
    throw createError
  }
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
