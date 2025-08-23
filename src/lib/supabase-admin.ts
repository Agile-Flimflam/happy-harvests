// Server-only Supabase admin client using the service role key
// Do NOT import this in client components.

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key')
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey)
}


