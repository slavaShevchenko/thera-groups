import { createBrowserClient } from '@supabase/ssr'

export default defineNuxtPlugin(() => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return {
    provide: {
      supabase,
    },
  }
})
