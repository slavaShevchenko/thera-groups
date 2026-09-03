import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export const useSupabaseClient = () => {
  if (!client) {
    const config = useRuntimeConfig().public
    const supabaseUrl = config.supabaseUrl
    const supabaseAnonKey = config.supabaseAnonKey

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    }

    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return client
}
