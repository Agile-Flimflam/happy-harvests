'use client';

import { Suspense, useState, ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase';
import { AuthApiError } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginFormContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOAuthRedirecting, setIsOAuthRedirecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');
  const nextParam = searchParams.get('next') || '/';
  const supabase = createClient();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      let friendly = `Error: ${signInError.message}`;
      if (signInError instanceof AuthApiError) {
        if (signInError.status === 400) {
          friendly = 'Invalid email or password.';
        } else if (signInError.status === 403) {
          friendly = 'Email not confirmed. Please check your inbox to confirm your email.';
        }
      }
      setError(friendly);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.replace('/');
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsOAuthRedirecting(true);
      setError('');
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextParam)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthError) {
        setError(`Error: ${oauthError.message}`);
        setIsOAuthRedirecting(false);
      }
      // On success, the browser will redirect to Google → Supabase → our callback.
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error starting Google sign-in';
      setError(`Error: ${message}`);
      setIsOAuthRedirecting(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-center">Happy Harvests Login</h2>
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={isSubmitting}
            className="mt-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            disabled={isSubmitting}
            className="mt-1"
          />
        </div>
        <div className="flex items-center justify-between">
          <Link href="/auth/reset-password" className="text-sm text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Button>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or</span>
          </div>
        </div>
        <Button type="button" variant="outline" disabled={isOAuthRedirecting} onClick={handleGoogleSignIn} className="w-full">
          <span className="flex items-center justify-center gap-2">
            <svg aria-hidden="true" focusable="false" className="h-4 w-4" viewBox="0 0 18 18">
              <path fill="#EA4335" d="M17.64 9.2045c0-.638-.0573-1.2527-.1636-1.8409H9v3.4818h4.8445c-.2091 1.1277-.8436 2.0818-1.7964 2.7182v2.2546h2.9082c1.7027-1.5682 2.6836-3.8782 2.6836-6.6137z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.4727-.8073 5.9636-2.1818l-2.9082-2.2546c-.8073.54-1.8391.8591-3.0555.8591-2.35 0-4.3391-1.5845-5.0473-3.7136H.9382v2.3363C2.4218 15.8455 5.4818 18 9 18z"/>
              <path fill="#FBBC05" d="M3.9527 10.7091c-.18-.54-.2836-1.1164-.2836-1.7091s.1036-1.1691.2836-1.7091V4.9546H.9382C.34 6.1727 0 7.5545 0 9s.34 2.8273.9382 4.0455l3.0145-2.3364z"/>
              <path fill="#4285F4" d="M9 3.5455c1.32 0 2.5082.4545 3.4418 1.3455l2.5818-2.5818C13.4727.8373 11.43 0 9 0 5.4818 0 2.4218 2.1545.9382 5.0455l3.0145 2.3364C4.6609 5.1291 6.65 3.5455 9 3.5455z"/>
            </svg>
            {isOAuthRedirecting ? 'Redirecting…' : 'Continue with Google'}
          </span>
        </Button>
        {message && (
          <p className="text-sm text-center text-green-600">{message}</p>
        )}
        {error && (
          <p className="text-sm text-center text-red-600">{error}</p>
        )}
        {authError && !error && (
           <p className="text-sm text-center text-red-600">Error: {authError}</p>
        )}
      </form>
      <p className="text-xs text-center text-muted-foreground">Don’t have an account? Contact an administrator.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md p-8">Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}


