import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeSwitcherMount } from "@/components/theme/ThemeSwitcherMount";
import { FormControlSetup } from "@/components/form/FormControlSetup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Happy Harvests",
  description: "Garden plot management app",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors />
          {/* Theme switcher state, mounted once at app root */}
          <ThemeSwitcherMount />
          {/* Form control property setup for browser extensions */}
          <FormControlSetup />
        </ThemeProvider>
      </body>
    </html>
  );
}
