export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const isProduction = process.env.NODE_ENV === 'production'

  const requiredPrivate: [string, string][] = [
    ['databaseUrl', 'DATABASE_URL'],
    ['supabaseServiceRoleKey', 'SUPABASE_SERVICE_ROLE_KEY'],
    ['supabaseAnonKey', 'SUPABASE_ANON_KEY'],
  ]

  const requiredPublic: [string, string][] = [
    ['supabaseUrl', 'SUPABASE_URL'],
    ['siteUrl', 'SITE_URL'],
  ]

  // Без этих переменных приложение продолжает работать: отправка почты
  // деградирует в EmailEvent с причиной ошибки, Google OAuth целиком
  // обслуживается на стороне Supabase, jwtSecret в коде не потребляется.
  const optionalPrivate: [string, string][] = [
    ['resendApiKey', 'RESEND_API_KEY'],
    ['emailFrom', 'EMAIL_FROM'],
    ['googleClientId', 'GOOGLE_CLIENT_ID'],
    ['googleClientSecret', 'GOOGLE_CLIENT_SECRET'],
    ['jwtSecret', 'JWT_SECRET'],
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

  // У SITE_URL в nuxt.config.ts есть fallback на localhost, поэтому проверка на
  // пустое значение не срабатывает никогда. В проде localhost означает, что
  // canonical, sitemap.xml и Open Graph молча строятся от неверного хоста.
  if (isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(config.public.siteUrl as string)) {
    missing.push('SITE_URL')
  }

  const absentOptional = optionalPrivate
    .filter(([key]) => !config[key])
    .map(([, envName]) => envName)

  if (absentOptional.length > 0) {
    console.warn(`⚠️  Optional env variables are not set: ${absentOptional.join(', ')}`)
  }

  // process.exit(1) внутри Nitro-плагина на Vercel выглядит как непрозрачный
  // срыв cold start, поэтому отсутствующие переменные сообщаются через исключение.
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required env variables: ${missing.join(', ')}\n`
      + 'Please check your .env file',
    )
  }

  // eslint-disable-next-line no-console
  console.log('✅ All required env variables are set')
})
