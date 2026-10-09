/**
 * Fallback sender for deployments that never set EMAIL_FROM. Shared with the email
 * transport so both read the same default instead of one silently skipping.
 */
export const DEFAULT_EMAIL_FROM = 'noreply@psygroup.org'

/**
 * One server-side configuration value, resolved from `runtimeConfig` first and the bare
 * environment name second.
 *
 * Neither `nuxt.config.ts` nor this file inlines a secret: `runtimeConfig` holds empty
 * defaults, so nothing sensitive is baked into `.output`, and the two lookups mean both
 * spellings work — `NUXT_RESEND_API_KEY` (Nitro's runtime override) and `RESEND_API_KEY`
 * (what `.env` and the Vercel dashboard provide). Rotating one is a restart, not a rebuild.
 */
export function resolveEnvValue(runtimeValue: unknown, envName: string): string {
  if (typeof runtimeValue === 'string' && runtimeValue !== '') return runtimeValue

  return process.env[envName] ?? ''
}

export interface ServerEnv {
  databaseUrl: string
  supabaseServiceRoleKey: string
  supabaseAnonKey: string
  resendApiKey: string
  emailFrom: string
  resendWebhookSecret: string
  adminEmail: string
  adminPassword: string
  siteUrl: string
  supabaseUrl: string
}

type RuntimeConfigLike = Record<string, unknown> & { public?: Record<string, unknown> }

/**
 * Every value the server reads, resolved. No defaults applied — the caller decides what an
 * empty string means, which is what makes `validateServerEnv` able to tell "not configured"
 * from "configured as the fallback".
 *
 * The two public keys come from `runtimeConfig` only, with no environment fallback: the
 * client bundle reads the same object, and a server-side override would make canonical URLs
 * and Open Graph tags disagree between the two. They are not secrets, so a build-time value
 * is the right trade.
 *
 * `runtimeConfig` is a parameter with a default rather than a call inside the body so the
 * wiring is testable without a Nuxt app instance.
 */
export function resolveServerEnv(runtimeConfig: RuntimeConfigLike = useRuntimeConfig()): ServerEnv {
  const publicConfig = runtimeConfig.public ?? {}

  const publicValue = (value: unknown) => (typeof value === 'string' ? value : '')

  return {
    databaseUrl: resolveEnvValue(runtimeConfig.databaseUrl, 'DATABASE_URL'),
    supabaseServiceRoleKey: resolveEnvValue(runtimeConfig.supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    supabaseAnonKey: resolveEnvValue(runtimeConfig.supabaseAnonKey, 'SUPABASE_ANON_KEY'),
    resendApiKey: resolveEnvValue(runtimeConfig.resendApiKey, 'RESEND_API_KEY'),
    emailFrom: resolveEnvValue(runtimeConfig.emailFrom, 'EMAIL_FROM'),
    // Read from the environment alone: the webhook handler verifies signatures outside any
    // Nuxt runtime (server/api/webhooks/resend.post.ts), so a runtimeConfig copy of the
    // same secret would be a second source free to disagree with the one that is used.
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? '',
    adminEmail: resolveEnvValue(runtimeConfig.adminEmail, 'ADMIN_EMAIL'),
    adminPassword: resolveEnvValue(runtimeConfig.adminPassword, 'ADMIN_PASSWORD'),
    siteUrl: publicValue(publicConfig.siteUrl),
    supabaseUrl: publicValue(publicConfig.supabaseUrl),
  }
}

export function useServerConfig(runtimeConfig?: RuntimeConfigLike) {
  const env = resolveServerEnv(runtimeConfig)

  return {
    ...env,
    emailFrom: env.emailFrom || DEFAULT_EMAIL_FROM,
  }
}

type EnvEntry = [keyof ServerEnv, string]

const ALWAYS_REQUIRED: EnvEntry[] = [
  ['databaseUrl', 'DATABASE_URL'],
  ['supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY'],
  ['supabaseAnonKey', 'SUPABASE_ANON_KEY'],
  ['supabaseUrl', 'SUPABASE_URL'],
  ['siteUrl', 'SITE_URL'],
]

/**
 * Mail is the only channel that reaches an applicant or an organizer, so a deployment
 * without it is not "email disabled" — it is a catalog that silently never tells anyone
 * anything. In dev the trio stays optional: a local checkout with no Resend account must
 * still boot, and the email service degrades to a DEV_PREVIEW row.
 */
const REQUIRED_IN_PRODUCTION: EnvEntry[] = [
  ['resendApiKey', 'RESEND_API_KEY'],
  ['emailFrom', 'EMAIL_FROM'],
  ['resendWebhookSecret', 'RESEND_WEBHOOK_SECRET'],
]

const OPTIONAL: EnvEntry[] = [
  // Required in neither place: they only matter while the database has zero admins, and a
  // local dev without them must still start.
  ['adminEmail', 'ADMIN_EMAIL'],
  ['adminPassword', 'ADMIN_PASSWORD'],
]

const LOCALHOST_URL = /^https?:\/\/(localhost|127\.0\.0\.1)/

export interface EnvValidation {
  /** Environment names that stop the process from starting. */
  missing: string[]
  /** Environment names worth a warning and nothing more, in every mode. */
  absentOptional: string[]
  /** Empty in production, where they are `missing` instead: optional here, fatal there. */
  absentRequiredInProduction: string[]
}

/**
 * Decides what a deployment is missing. Pure: it takes the already-resolved values so the
 * rule is testable without a Nitro runtime, and so the message names environment variables
 * rather than internal keys.
 */
export function validateServerEnv(env: ServerEnv, isProduction: boolean): EnvValidation {
  const missing: string[] = []
  const absentOptional: string[] = []
  const absentRequiredInProduction: string[] = []

  for (const [key, envName] of ALWAYS_REQUIRED) {
    if (!env[key]) missing.push(envName)
  }

  for (const [key, envName] of OPTIONAL) {
    if (!env[key]) absentOptional.push(envName)
  }

  for (const [key, envName] of REQUIRED_IN_PRODUCTION) {
    if (env[key]) continue

    if (isProduction) missing.push(envName)
    else absentRequiredInProduction.push(envName)
  }

  // SITE_URL has a localhost fallback in nuxt.config.ts, so the emptiness check above never
  // fires for it. In production localhost means canonical, sitemap.xml and Open Graph are
  // all being built from the wrong host.
  if (isProduction && LOCALHOST_URL.test(env.siteUrl)) {
    missing.push('SITE_URL')
  }

  return { missing, absentOptional, absentRequiredInProduction }
}
