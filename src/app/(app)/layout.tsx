import type { Metadata } from "next";
import NavLinks from './_components/NavLinks';
import AuthButton from './_components/AuthButton';
import { getUser } from '@/lib/supabase-server';
import { Leaf } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Happy Harvests",
  description: "Garden plot management app",
};

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <>
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-[60px] items-center border-b px-6">
              <Link className="flex items-center gap-2 font-semibold" href="/">
                <Leaf className="h-6 w-6 text-green-600" />
                <span>Happy Harvests</span>
              </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
              <NavLinks />
            </div>
            <div className="mt-auto p-4 border-t">
              <AuthButton initialUser={user} />
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-gray-100/40 px-6 dark:bg-gray-800/40 lg:hidden">
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Leaf className="h-6 w-6 text-green-600" />
              <span className="sr-only">Happy Harvests</span>
            </Link>
            <div className="ml-auto">
              <AuthButton initialUser={user} />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            {children}
          </main>
        </div>
      </div>
      {/* Toaster is now provided globally in root layout */}
    </>
  );
}


