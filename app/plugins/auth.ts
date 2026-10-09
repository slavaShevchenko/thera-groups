/**
 * Resolves the session before the router runs, on the server as well as the client.
 *
 * Without this, an SSR render always saw `user === null` — `useUser()` refused to fetch
 * on the server — so a hard load, a refresh, a bookmark or a link from an email hit
 * every private page as an anonymous visitor and the guard redirected a signed-in user
 * to the login page. Plugins are awaited before route middleware, so by the time
 * `auth.global.ts` runs the session is settled and the guards can read it synchronously.
 *
 * `fetchUser()` never rejects (it treats an unresolvable session as "not signed in"),
 * so a failing auth call cannot block the render.
 */
export default defineNuxtPlugin(async () => {
  const { fetchUser } = useUser()

  await fetchUser()
})
