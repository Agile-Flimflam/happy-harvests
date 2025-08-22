'use client';

import { createClient } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';

// Accept initial user data fetched on the server
export default function AuthButton({ initialUser }: { initialUser: User | null }) {
  const router = useRouter();
  const supabase = createClient(); // Client-side client

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh(); // Refresh server components
    router.push('/login'); // Redirect to login after sign out
  };

  return initialUser ? (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
        {initialUser.email}
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  ) : (
    // If somehow rendered without a user (e.g., error state), provide login option
    <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
        Login
    </Button>
  );
}


