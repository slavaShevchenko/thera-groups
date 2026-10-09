import type { H3Event } from 'h3'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { normalizeEmail } from './emailAddress'

export function createServerClient(event: H3Event) {
  const { supabaseUrl, supabaseAnonKey } = useServerConfig()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = parseCookies(event)
        return Object.entries(cookies).map(([name, value]) => ({ name, value }))
      },

      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(event, name, value, {
            ...options,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          })
        }

        for (const [key, value] of Object.entries(headers)) {
          setResponseHeader(event, key, value)
        }
      },
    },
  })
}

export function createAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = useServerConfig()

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createSupabaseServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      getAll() {
        return []
      },
    },
  })
}

export type AdminClient = ReturnType<typeof createAdminClient>

const AUTH_USERS_PAGE_SIZE = 1000
const AUTH_USERS_MAX_PAGES = 50

export interface AuthUserMatch {
  id: string
  /**
   * Providers linked to this auth record. Empty, or holding only `email`, means a plain
   * password sign-up; anything else means the account belongs to a social identity.
   */
  providers: string[]
}

/**
 * Every `auth.users` record holding this address.
 *
 * GoTrue serves `/admin/users` 50 at a time, so `listUsers()` with no arguments
 * answers only for the first 50 accounts and silently misses everyone past
 * them. Pages are advanced by hand rather than through the returned `nextPage`:
 * auth-js builds it from the `Link` header with `substring(0, 1)`, which reads
 * page 10 as page 1 and would end the walk early. The server is also free to
 * serve fewer rows than the requested `perPage`, so the only dependable end of
 * the directory is an empty page or one shorter than the page before it.
 *
 * `email` is compared normalized — GoTrue stores addresses lower-cased, and the caller
 * looks up `public.User` with a byte-for-byte unique match, so the two sides have to agree
 * on one spelling before a missing local row can be read as "orphaned".
 */
export async function findAuthUsersByEmail(
  adminClient: AdminClient,
  email: string,
): Promise<AuthUserMatch[]> {
  const target = normalizeEmail(email)
  const matches: AuthUserMatch[] = []

  let previousCount: number | null = null

  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    })

    if (error) throw error

    for (const user of data.users) {
      if (user.email && normalizeEmail(user.email) === target) {
        matches.push({
          id: user.id,
          providers: (user.identities ?? []).map(identity => identity.provider),
        })
      }
    }

    const count = data.users.length
    if (count === 0 || (previousCount !== null && count < previousCount)) break

    previousCount = count
  }

  return matches
}
