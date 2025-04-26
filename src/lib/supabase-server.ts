import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';
import type { Database } from './database.types'; // Use generated types

// Re-export types used in both server and client
export type { Database };
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Server-side client (for use ONLY in Server Components and Server Actions)
export function createSupabaseServerClient() {
  const cookieStore = cookies(); // Should be synchronous in this context
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (e) {
          // We can ignore this when not in a browser context
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (e) {
          // We can ignore this when not in a browser context
        }
      },
    },
  });
}

// Server client specifically for Route Handlers (uses NextRequest)
export function createSupabaseRouteHandlerClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
          get(name: string) {
              return req.cookies.get(name)?.value;
          },
          // Set and remove are handled manually in the route handler's response
          set() {},
          remove() {},
      },
  });
}

// Utility to get user session server-side
export async function getUserSession() {
  const supabase = createSupabaseServerClient();
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error.message);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error in getUserSession:', error);
    return null;
  }
}

// Utility to get user server-side
export async function getUser() {
  const supabase = createSupabaseServerClient();
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting user:', error.message);
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error in getUser:', error);
    return null;
  }
} 