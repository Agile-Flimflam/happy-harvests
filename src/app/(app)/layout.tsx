import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserAndProfile } from "@/lib/supabase-server";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MobileSidebarAutoClose } from "@/components/MobileSidebarAutoClose";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { ModeToggle } from "@/components/theme/ModeToggle";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar initialUser={user} initialProfile={profile} />
        <MobileSidebarAutoClose />
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
            <SidebarTrigger />
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Leaf className="h-6 w-6 text-green-600" />
              <span className="sr-only">Happy Harvests</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}


