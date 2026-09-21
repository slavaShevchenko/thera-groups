export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, event) => {
    const eventPath = event && 'path' in event ? (event as { path?: string }).path : 'unknown'
    console.error(`[unhandled] path=${eventPath}`, error)
  })
})
