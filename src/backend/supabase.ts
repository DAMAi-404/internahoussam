/**
 * Supabase backend. Implemented in Step 6 (see docs/ARCHITECTURE.md §5).
 * Until then, configuring Supabase env vars without this file being complete fails loudly at start.
 */
import type { Backend } from './types'

export function createSupabaseBackend(): Backend {
  throw new Error('Supabase backend not implemented yet (Step 6).')
}
