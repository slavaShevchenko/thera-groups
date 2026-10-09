/**
 * Fallback sender for deployments that never set EMAIL_FROM. Shared with the email
 * transport so both read the same default instead of one silently skipping.
 */
export const DEFAULT_EMAIL_FROM = 'noreply@psygroup.org'

export function useServerConfig() {
  const config = useRuntimeConfig()

  return {
    databaseUrl: config.databaseUrl as string,
    supabaseServiceRoleKey: config.supabaseServiceRoleKey as string,
    resendApiKey: config.resendApiKey as string,
    emailFrom: (config.emailFrom as string) || DEFAULT_EMAIL_FROM,
    googleClientId: config.googleClientId as string,
    googleClientSecret: config.googleClientSecret as string,
    jwtSecret: config.jwtSecret as string,
    adminEmail: (config.adminEmail as string) || '',
    adminPassword: (config.adminPassword as string) || '',
    siteUrl: config.public.siteUrl as string,
    supabaseUrl: config.public.supabaseUrl as string,
    supabaseAnonKey: config.supabaseAnonKey as string,
  }
}
