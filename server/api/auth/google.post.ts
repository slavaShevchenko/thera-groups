import { createAdminClient, createServerClient } from '../../utils/supabase'
import { userRepository } from '../../repositories/userRepository'
import { useRateLimiter, authLimiter } from '../../utils/rateLimit'
import { normalizeEmail } from '../../utils/emailAddress'
import { findPrismaError } from '../../utils/errorHandler'
import { apiError } from '../../utils/apiError'
import { ErrorCodes } from '../../utils/errorCodes'

const oauthFailed = () => apiError(400, ErrorCodes.VALIDATION_FAILED, 'oauth_failed')

// Two different accounts, one address. Refused rather than merged: silently adopting the
// existing row would hand the Google caller somebody else's groups and applications. The
// caller ends the session first — see `endRefusedSession`.
const emailOwnedByAnotherIdentity = () =>
  apiError(
    409,
    ErrorCodes.CONFLICT,
    'Account with this email exists under a different provider',
  )

/**
 * A Google identity with no account behind it.
 *
 * Google signs an account in; it never creates one. Registration is the only path that
 * opens an `OrganizerProfile`, because it is the only one that can ask the questions a
 * profile has to answer — a provider hands over an address and sometimes a name, and
 * nothing else. Signing up through it therefore produced a PENDING profile that
 * `organizerService.moderateProfile` could never approve, queued beside the ones that
 * could, while the organizer had been told the profile was "under review". The callback
 * page reads the 404 and offers registration instead.
 *
 * The refusal has to clean up after itself — see `clearRefusedSignup`.
 */
const noAccountForThisIdentity = () =>
  apiError(404, ErrorCodes.NOT_FOUND, 'No account for this Google identity')

// The cleanups a refusal owes: the 404 owes both, the 409 only the sign-out. Neither may
// change the answer, so both are best-effort — a refusal is already correct, and a provider
// failure would turn it into a 500 that tells the visitor nothing they can act on. What is
// left behind gets one warning line each.

/**
 * Ends the session the code exchange opened.
 *
 * `exchangeCodeForSession` writes session cookies on its way in and this handler refuses the
 * identity afterwards. What stays on the browser is then a valid session that no
 * `public.User` row answers to, and `getUser()` auto-provisions a `VISITOR` for exactly that.
 * Every endpoint behind `requireAuth()` reaches it, and so do the public reads that call it
 * optionally (`/api/groups/[slug]`, `/api/organizers`, `/api/organizers/[slug]`), so the
 * refused visitor's *next* page view is what creates the account this refusal exists to
 * prevent — or, when the address already belongs to another identity, dies on the unique
 * `email` and answers 409 to a public group page until the cookies are cleared.
 *
 * The deactivated-account 403 does not sign out: there the row exists and is found by
 * `authId`, so `requireAuth()` answers 403 and `/api/auth/me` reports `ACCOUNT_DISABLED`,
 * which is the revocation path `docs/security.md §8` describes.
 */
async function endRefusedSession(supabase: ReturnType<typeof createServerClient>) {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
  catch (error) {
    console.warn(`[auth.google] refused sign-in kept its session: ${(error as Error).message}`)
  }
}

/**
 * Removes the `auth.users` row Supabase wrote while exchanging the code.
 *
 * Not cosmetic. Exchanging a code signs the identity up in GoTrue whether or not this
 * handler likes the result, and `register.post.ts` deliberately refuses to clear an orphan
 * carrying a social identity: it cannot tell "somebody clicked Google and was refused" from
 * "somebody else's account", and guessing wrong is an account takeover. So a row left
 * behind here would answer `409 CONFLICT` to the very registration this 404 sends the
 * visitor to, and the two policies would deadlock.
 *
 * Deleting it is safe in a way `register.post.ts` deleting it is not: the caller proved
 * control of the address seconds ago by completing the provider's own consent flow, and the
 * row has no `public.User` behind it, so there is no account to take over.
 */
async function clearRefusedSignup(authId: string) {
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(authId)
    if (error) throw error
  }
  catch (error) {
    console.warn(`[auth.google] refused sign-up kept auth user ${authId}: ${(error as Error).message}`)
  }
}

const isUniqueViolation = (error: unknown) => findPrismaError(error)?.code === 'P2002'

/**
 * What reconciliation made of the identity.
 *
 * `reconciled` means nothing stands between the caller and its own lookup — the row was
 * already linked, has just been linked, or does not exist at all, which the caller reads as
 * a refused sign-up. A conflict is **returned** rather than thrown because refusing one
 * owes the same session cleanup as refusing a sign-up, and only the caller holds the event.
 */
type Reconciliation = 'reconciled' | 'conflict'

/**
 * Makes `public.User` agree with the identity Supabase just authenticated.
 *
 * Resolution is by `authId` first and by email second, which is the opposite of what it
 * used to be. Email-only matching meant a Google account whose address changed could
 * never be reconciled: the local row kept the old address, the new one matched nothing,
 * and every later sign-in either created a second account or died on the unique `email`
 * with a P2002 nobody could recover from. Now:
 *
 *  1. a row already carrying this `authId` is the same person — repair its address;
 *  2. a row carrying the address with **no** `authId` is a password sign-up meeting its
 *     provider for the first time — link them;
 *  3. a row carrying the address under a **different** `authId` is somebody else — conflict;
 *  4. otherwise the identity is new, and the caller refuses it.
 */
async function reconcileLocalUser(authId: string, email: string): Promise<Reconciliation> {
  const byAuthId = await userRepository.findSessionUserByAuthId(authId)

  if (byAuthId) {
    if (byAuthId.email === email) return 'reconciled'

    try {
      await userRepository.update(byAuthId.id, { email })
    }
    catch (error) {
      // The new address already belongs to a different local account.
      if (isUniqueViolation(error)) return 'conflict'
      throw error
    }

    return 'reconciled'
  }

  const link = await userRepository.findAuthLinkByEmail(email)

  if (!link) return 'reconciled'

  if (link.authId && link.authId !== authId) {
    return 'conflict'
  }

  if (link.authId === authId) return 'reconciled'

  try {
    await userRepository.update(link.id, { authId })
  }
  catch (error) {
    if (isUniqueViolation(error)) return 'conflict'
    throw error
  }

  return 'reconciled'
}

export default defineEventHandler(async (event) => {
  await useRateLimiter(event, authLimiter)

  const body = await readBody<{ code: string }>(event)

  if (!body?.code) {
    throw apiError(400, ErrorCodes.VALIDATION_FAILED, 'Missing code')
  }

  const supabase = createServerClient(event)

  const { error: exchangeError, data: sessionData } = await supabase.auth.exchangeCodeForSession(body.code)

  if (exchangeError) {
    throw oauthFailed()
  }

  const authId = sessionData.user?.id
  const rawEmail = sessionData.user?.email

  if (!authId || !rawEmail) {
    throw oauthFailed()
  }

  // GoTrue stores addresses lower-cased, but nothing forces a provider to send one that
  // way, and every lookup below is a byte-for-byte unique match.
  const email = normalizeEmail(rawEmail)

  const reconciliation = await reconcileLocalUser(authId, email)

  // The conflict owes the same sign-out the refused sign-up below does: the session the
  // exchange opened resolves to no row of its own, and the address it carries belongs to
  // an account under a different `authId`, so `getUser()` would try to create a second one
  // and die on the unique `email`. The GoTrue row survives — this address has a real
  // account behind it, so there is no orphan blocking a registration to clear.
  if (reconciliation === 'conflict') {
    await endRefusedSession(supabase)

    throw emailOwnedByAnotherIdentity()
  }

  const user = await userRepository.findSessionUserByAuthId(authId)

  if (!user) {
    await endRefusedSession(supabase)
    await clearRefusedSignup(authId)

    throw noAccountForThisIdentity()
  }

  // Checked after resolution rather than only on the path that linked a row: an account
  // deactivated while its Google session is still valid must not get back in.
  if (!user.isActive) {
    throw apiError(403, ErrorCodes.FORBIDDEN, 'Account is deactivated')
  }

  return { success: true, user }
})
