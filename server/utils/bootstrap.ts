import { prisma } from './prisma'
import { createAdminClient, findAuthUsersByEmail } from './supabase'
import { useServerConfig } from './config'
import { findPrismaError, logHandlerError } from './errorHandler'

export type BootstrapResult
  = | 'already-present'
    | 'created'
    | 'promoted'
    | 'not-configured'
    | 'failed'

const isAlreadyRegistered = (error: { message?: string, code?: string }) =>
  error.message?.includes('already been registered') || error.code === 'email_exists'

/**
 * The `auth.users` id for this address, creating the account when it is missing.
 *
 * An address that exists in `auth.users` with no `public.User` row blocks every retry, so
 * the orphan is cleared and the sign-up replayed — the same recovery `register.post.ts`
 * performs. `findAuthUsersByEmail` pages by hand because GoTrue serves 50 rows per call
 * and auth-js misparses `nextPage`.
 */
async function ensureAuthUser(email: string, password: string): Promise<string> {
  const adminClient = createAdminClient()
  const create = () => adminClient.auth.admin.createUser({ email, password, email_confirm: true })

  let { data, error } = await create()

  if (error && isAlreadyRegistered(error)) {
    const orphans = await findAuthUsersByEmail(adminClient, email)

    for (const orphan of orphans) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(orphan.id)
      if (deleteError) {
        console.warn(`[bootstrap] orphaned auth user ${orphan.id} not deleted: ${deleteError.message}`)
      }
    }

    const retry = await create()
    data = retry.data
    error = retry.error
  }

  if (error || !data?.user) {
    throw new Error(error?.message || 'Supabase createUser returned no user')
  }

  return data.user.id
}

/**
 * Creates the first ADMIN of an empty database.
 *
 * A fresh production database cannot contain one: the seed refuses to run outside
 * localhost and registration only ever creates VISITOR or ORGANIZER. Without an admin
 * nobody verifies organizers and nobody publishes groups, so the catalog stays empty
 * forever. `ADMIN_EMAIL`/`ADMIN_PASSWORD` close that gap once — as soon as one ADMIN
 * exists this is a single `SELECT` per cold start and the variables are ignored.
 *
 * Never throws: a failed bootstrap must not take the application down.
 */
export async function bootstrapFirstAdmin(): Promise<BootstrapResult> {
  try {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount > 0) return 'already-present'

    const { adminEmail, adminPassword } = useServerConfig()

    if (!adminEmail || !adminPassword) {
      console.warn('[bootstrap] no admin in database and ADMIN_EMAIL/ADMIN_PASSWORD not set — run seed or set env')
      return 'not-configured'
    }

    const existing = await prisma.user.findUnique({ where: { email: adminEmail } })

    // The address belongs to a real account, not an auth orphan: promote it instead of
    // deleting its `auth.users` row, which would orphan every session it already has.
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', isActive: true },
      })
      // eslint-disable-next-line no-console -- a one-time cold-start signal, like configValidation's
      console.log(`[bootstrap] promoted existing account ${adminEmail} to ADMIN`)
      return 'promoted'
    }

    const authId = await ensureAuthUser(adminEmail, adminPassword)

    await prisma.user.create({
      data: { authId, email: adminEmail, role: 'ADMIN', isActive: true },
    })

    // eslint-disable-next-line no-console -- a one-time cold-start signal, like configValidation's
    console.log(`[bootstrap] created the first ADMIN: ${adminEmail}`)
    return 'created'
  }
  catch (error) {
    // Two instances cold-starting at once race for the same unique email. One wins and
    // the loser reports the admin as present, which is the truth by then.
    if (findPrismaError(error)?.code === 'P2002') return 'already-present'

    // The password is a value of `useServerConfig()`, never part of a message, so the
    // shared logger cannot put it on a line.
    logHandlerError(error, { source: 'bootstrap' })
    return 'failed'
  }
}
