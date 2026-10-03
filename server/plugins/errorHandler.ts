import { logCapturedError } from '../utils/errorHandler'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, context) => {
    logCapturedError(error, context)
  })
})
