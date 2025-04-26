'use client'; // Mark this file as a client component

// Import types and browser client
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types'; // Use generated types

// Type aliases for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Client-side client (for use in client components)
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Export types for server functions (these are implemented in supabase-server.ts)
export type { 
  CookieOptions
} from '@supabase/ssr'; 