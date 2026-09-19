export function useServerConfig() {
  const config = useRuntimeConfig()

  return {
    databaseUrl: config.databaseUrl as string,
    supabaseServiceRoleKey: config.supabaseServiceRoleKey as string,
    resendApiKey: config.resendApiKey as string,
    emailFrom: (config.emailFrom as string) || 'noreply@psygroup.org',
    googleClientId: config.googleClientId as string,
    googleClientSecret: config.googleClientSecret as string,
    jwtSecret: config.jwtSecret as string,
    siteUrl: config.public.siteUrl as string,
    supabaseUrl: config.public.supabaseUrl as string,
    supabaseAnonKey: config.public.supabaseAnonKey as string,
  }
}
