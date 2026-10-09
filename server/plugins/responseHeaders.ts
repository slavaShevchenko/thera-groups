import { removeResponseHeader } from 'h3'

/**
 * Drops `x-powered-by: Nuxt`, which the renderer attaches to every HTML response.
 *
 * `routeRules` cannot remove it: the header is added after route rules are applied, so it
 * has to be taken off on the way out. Both render paths are covered — the buffered one
 * carries it in `response.headers`, which Nitro applies to the event *after* this hook
 * runs, and the streamed one sets it on the event directly.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response, { event }) => {
    const headers = response.headers as Record<string, string> | undefined

    if (headers) delete headers['x-powered-by']

    removeResponseHeader(event, 'x-powered-by')
  })
})
