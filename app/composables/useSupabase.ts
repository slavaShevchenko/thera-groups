import { createBrowserClient } from '@supabase/ssr'

export const useSupabase = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }

  if (!window.__supabaseClient) {
    window.__supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return window.__supabaseClient
}

declare global {
  interface Window {
    __supabaseClient: ReturnType<typeof createBrowserClient> | undefined
  }
}
