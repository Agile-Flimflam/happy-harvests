'use client';

import { Suspense, useState, ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase'; // Import from the correct client library path
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams } from 'next/navigation';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supabase = createClient(); // Get client-side Supabase instance
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Set this to false if you want the user to be automatically signed in
        // after clicking the link. Setting to true requires manual sign in after redirect.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`, // Your callback URL
      },
    });

    if (signInError) {
      console.error('Sign-in error:', signInError.message);
      setError(`Error: ${signInError.message}`);
    } else {
      setMessage('Check your email for the login link!');
    }
    setIsSubmitting(false);
    setEmail(''); // Clear email field after submission
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-center">Happy Harvests Login</h2>
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
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
          {isSubmitting ? 'Sending...' : 'Send Login Link'}
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


