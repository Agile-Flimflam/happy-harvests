'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    };
    void checkSession();
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      // Sign out the recovery session and take user to login
      await supabase.auth.signOut();
      router.replace('/login');
      return;
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-center">Set a new password</h2>
      {!hasSession && (
        <p className="text-sm text-center text-red-600">
          Password reset link invalid or expired. Request a new one on the{' '}
          <Link href="/auth/reset-password" className="underline underline-offset-4">reset page</Link>.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            disabled={isSubmitting}
            className="mt-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            required
            disabled={isSubmitting}
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={isSubmitting || !hasSession} className="w-full">
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
        {message && <p className="text-sm text-center text-green-600">{message}</p>}
        {error && <p className="text-sm text-center text-red-600">{error}</p>}
      </form>
      <div className="text-center text-sm">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">Go to dashboard</Link>
      </div>
    </div>
  );
}


