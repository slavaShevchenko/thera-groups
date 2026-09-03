import type { createBrowserClient } from '@supabase/ssr'

export const useSupabase = () => {
  const nuxtApp = useNuxtApp()
  return nuxtApp.$supabase as ReturnType<typeof createBrowserClient>
}
