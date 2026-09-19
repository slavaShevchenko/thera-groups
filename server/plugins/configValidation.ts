export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  const requiredPrivate: [string, string][] = [
    ['databaseUrl', 'DATABASE_URL'],
    ['supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY'],
    ['supabaseAnonKey', 'SUPABASE_ANON_KEY'],
  ]

  const requiredPublic: [string, string][] = [
    ['supabaseUrl', 'SUPABASE_URL'],
  ]

  const missing: string[] = []

  for (const [key, envName] of requiredPrivate) {
    if (!config[key]) {
      missing.push(envName)
    }
  }

  for (const [key, envName] of requiredPublic) {
    if (!config.public[key]) {
      missing.push(envName)
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required env variables: ${missing.join(', ')}`)

    console.error('Please check your .env file')
    process.exit(1)
  }

  // eslint-disable-next-line no-console
  console.log('✅ All required env variables are set')
})
