import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';
import type { Database } from './database.types'; // Adjust import path

// Re-export types used in both server and client
export type { Database };
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Server-side client (for use ONLY in Server Components and Server Actions)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // Await cookies() in Next.js 15+
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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

// Fetch the current user's profile (SSR)
export async function getUserProfile() {
  const supabase = await createSupabaseServerClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error('Error getting profile:', error.message);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Fetch both user and profile together
export async function getUserAndProfile() {
  const supabase = await createSupabaseServerClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { user: null, profile: null };
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error('Error getting profile:', error.message);
      return { user, profile: null };
    }
    return { user, profile };
  } catch (error) {
    console.error('Error in getUserAndProfile:', error);
    return { user: null, profile: null };
  }
}