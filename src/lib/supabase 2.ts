'use client'; // Mark this file as a client component

// IMPORTANT: Install Supabase SSR package:
// pnpm add @supabase/ssr
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
// import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'; // No longer needed here
import { type NextRequest } from 'next/server'
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
          // The `set` method needs a RequestCookies object.
          // `cookieStore` obtained from `cookies()` should work directly.
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
          // console.warn(`Server Component Warning: Failed to set cookie '${name}'. Ensure middleware handles session updates.`);
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          // The `delete` method needs a RequestCookies object.
          // `cookieStore` obtained from `cookies()` should work directly.
          cookieStore.set({ name, value: '', ...options }); // Setting empty value effectively removes
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
          // console.warn(`Server Component Warning: Failed to remove cookie '${name}'. Ensure middleware handles session updates.`);
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

  // For Route Handlers, cookies need to be handled via the Response object
  // Create a client without the cookie methods initially
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
          get(name: string) {
              return req.cookies.get(name)?.value;
          },
          // Set and remove are handled manually in the route handler's response
      },
  });

  return supabase;
}

// Utility to get user session server-side
export async function getUserSession() {
  // Use the server client appropriate for Server Components/Actions
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
    // Use the server client appropriate for Server Components/Actions
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

// Export types for server functions (these are implemented in supabase-server.ts)
export type { 
  CookieOptions
} from '@supabase/ssr'; 