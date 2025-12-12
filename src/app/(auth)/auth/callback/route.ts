import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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

  // Create a Supabase client wired to read incoming cookies and set outgoing cookies (Next 15+ API)
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
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

    // Optional: ensure a profile row exists for the authenticated user
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const metadata = (user.user_metadata || {}) as Record<string, unknown>;
        const fullName =
          (metadata['full_name'] as string | undefined) ||
          (metadata['name'] as string | undefined) ||
          null;
        const avatarUrl =
          (metadata['avatar_url'] as string | undefined) ||
          (metadata['picture'] as string | undefined) ||
          null;
        // Upsert minimal profile; RLS should allow insert where auth.uid() = new.id
        const payload: Database['public']['Tables']['profiles']['Insert'] = {
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
        };
        const admin = createSupabaseAdminClient();
        await admin.from('profiles').upsert(payload, { onConflict: 'id' });
      }
    } catch (profileErr) {
      console.error('Auth callback profile upsert error:', profileErr);
      // Do not block auth on profile failure
    }
  } catch (err) {
    console.error('Supabase auth callback error:', err);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_failed`);
  }

  return response;
}
