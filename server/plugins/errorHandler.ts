import { isLogged, logCapturedError } from '../utils/errorHandler'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, context) => {
    // A handler that routed the failure through sanitizeError() already logged it,
    // under a more specific source than `unhandled`.
    if (isLogged(error)) return
    logCapturedError(error, context)
  })
})
