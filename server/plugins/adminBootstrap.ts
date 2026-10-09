import { bootstrapFirstAdmin } from '../utils/bootstrap'

export default defineNitroPlugin(() => {
  // Not awaited on purpose: Nitro runs plugins synchronously, so waiting here would push
  // the first request behind a Supabase round-trip on every cold start.
  // `bootstrapFirstAdmin()` catches everything and never rejects.
  void bootstrapFirstAdmin()
})
