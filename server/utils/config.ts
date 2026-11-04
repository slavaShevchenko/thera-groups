/**
 * Fallback sender for deployments that never set EMAIL_FROM. Shared with the email
 * transport so both read the same default instead of one silently skipping.
 */
export const DEFAULT_EMAIL_FROM = 'noreply@psygroup.org'

/**
 * Bucket that holds organizer avatars.
 *
 * Supabase Storage buckets live in the `storage` schema, which Prisma does not manage, so no
 * migration in `database/migrations/` creates this one — in the current project it was made
 * by hand, and nothing in the repo said so. The name is configurable so a freshly
 * provisioned Supabase project can be pointed at whatever bucket was created there instead
 * of failing every upload with a 500, and so the value is discoverable from `.env.example`
 * rather than only from the handler that reads it. Creating the bucket itself, with the
 * public-read policy `getPublicUrl()` depends on, is a deployment step — see
 * docs/deployment.md#storage-buckets.
 */
export const DEFAULT_ORGANIZER_AVATARS_BUCKET = 'organizer-avatars'

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
  storageBucketOrganizerAvatars: string
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
    storageBucketOrganizerAvatars: resolveEnvValue(
      runtimeConfig.storageBucketOrganizerAvatars,
      'STORAGE_BUCKET_ORGANIZER_AVATARS',
    ),
  }
}

export function useServerConfig(runtimeConfig?: RuntimeConfigLike) {
  const env = resolveServerEnv(runtimeConfig)

  return {
    ...env,
    emailFrom: env.emailFrom || DEFAULT_EMAIL_FROM,
    // Same shape as the sender default: the bucket name is a deployment detail with a
    // working default, not a secret whose absence should stop the process.
    storageBucketOrganizerAvatars:
      env.storageBucketOrganizerAvatars || DEFAULT_ORGANIZER_AVATARS_BUCKET,
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

/**
 * True for a URL that points at the machine serving it — `nuxt.config.ts`'s `SITE_URL`
 * fallback, and therefore the marker for "this deployment has no public origin configured".
 */
export function isLocalhostUrl(url: string): boolean {
  return LOCALHOST_URL.test(url)
}

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
  // fires for it. Two production-only rules, because this one value is what every canonical
  // URL, sitemap entry and Open Graph tag is built from:
  //  - localhost points all of them at a host nobody else can reach;
  //  - a plain `http://` points them at a scheme the site itself refuses, since HSTS and the
  //    `secure` cookie flag turn every such URL into a redirect. Google reads an http
  //    canonical on an https page as a mismatch and simply does not adopt it, so the whole
  //    sitemap would be published at URLs the deployment never serves.
  // One `push` for both, so the message still names SITE_URL exactly once.
  if (isProduction && (isLocalhostUrl(env.siteUrl) || !env.siteUrl.startsWith('https://'))) {
    missing.push('SITE_URL')
  }

  return { missing, absentOptional, absentRequiredInProduction }
}
