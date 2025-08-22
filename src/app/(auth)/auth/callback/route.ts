import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  // Supabase returns either `code` (PKCE) or `token` (magiclink) depending on the flow
  const code = requestUrl.searchParams.get('code');
  const token = requestUrl.searchParams.get('token');
  const nextPath = requestUrl.searchParams.get('next') ?? '/';

  // Prepare a redirect response early so we can attach cookies to it
  const response = NextResponse.redirect(new URL(nextPath, requestUrl));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Create a Supabase client wired up to read from the incoming request cookies and
  // set cookies on the outgoing response
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  try {
    if (code) {
      // PKCE flow
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (token) {
      // Magic‑link flow – Supabase treats the token param the same as code
      const { error } = await supabase.auth.exchangeCodeForSession(token);
      if (error) throw error;
    }
  } catch (err) {
    console.error('Supabase auth callback error:', err);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
  }

  return response;
}


