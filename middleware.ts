import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
// Import Database type directly from the generated file
import type { Database } from '@/lib/database.types';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware Error: Missing Supabase URL or Anon Key');
    return response;
  }

  // Pass Database type generic to createServerClient
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        });
        response = NextResponse.next({ request: { headers: request.headers } });
      },
    },
  });

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  // Auth condition: check if user is logged in
  const { pathname } = request.nextUrl;
  const loggedIn = !!session;

  // --- Auth Rules ---

  // Protect main app routes (everything except login and auth callback)
  if (pathname !== '/login' && !pathname.startsWith('/auth') && !loggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    console.log('Redirecting unauthenticated user to login'); 
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from the login page to the dashboard
  if (pathname === '/login' && loggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    console.log('Redirecting authenticated user from login to dashboard');
    return NextResponse.redirect(url);
  }

  // Allow access to auth callback and other unprotected routes
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes, if any)
     * - auth/callback (Supabase auth callback)
     * Modify matcher to exclude specific routes needed before auth check.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)',
  ],
}; 