'use client';

import { useState, ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');

    // Build redirect URL from explicitly configured allowlisted origins.
    // This must match a Redirect URL in Supabase Auth settings.
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!configuredBaseUrl) {
      setIsSubmitting(false);
      setError('Password reset is unavailable: redirect URL not configured.');
      console.error(
        'Reset password blocked: configure NEXT_PUBLIC_SUPABASE_REDIRECT_URL (allowlisted in Supabase) or NEXT_PUBLIC_SITE_URL.'
      );
      return;
    }
    const normalizedBase = configuredBaseUrl.replace(/\/$/, '');
    const supabase = createClient();
    const redirectTo = `${normalizedBase}/auth/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('If an account exists for that email, a reset link has been sent.');
      setEmail('');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-center">Reset your password</h2>
      <form onSubmit={onSubmit} className="space-y-6">
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
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Sending…' : 'Send reset email'}
        </Button>
        {message && <p className="text-sm text-center text-green-600">{message}</p>}
        {error && <p className="text-sm text-center text-red-600">{error}</p>}
      </form>
      <div className="text-center text-sm">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
