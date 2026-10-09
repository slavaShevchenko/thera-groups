import { resolveServerEnv, validateServerEnv } from '../utils/config'

export default defineNitroPlugin(() => {
  const isProduction = process.env.NODE_ENV === 'production'
  const { missing, absentOptional, absentRequiredInProduction }
    = validateServerEnv(resolveServerEnv(), isProduction)

  if (absentOptional.length > 0) {
    console.warn(`⚠️  Optional env variables are not set: ${absentOptional.join(', ')}`)
  }

  // Said out loud on every dev boot, because the same three variables are fatal in
  // production: a local checkout with no Resend account must still start, and the gap
  // should not first appear as a failed deploy.
  if (absentRequiredInProduction.length > 0) {
    console.warn(
      `⚠️  Not set here, required in production: ${absentRequiredInProduction.join(', ')}`,
    )
  }

  // process.exit(1) inside a Nitro plugin on Vercel looks like an opaque cold-start
  // failure, so missing variables are reported through an exception instead.
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required env variables: ${missing.join(', ')}\n`
      + 'Please check your .env file',
    )
  }

  // eslint-disable-next-line no-console
  console.log('✅ All required env variables are set')
})
