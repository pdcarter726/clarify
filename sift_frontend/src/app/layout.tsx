import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/lib/toast-context";
import Navbar from "@/components/Navbar";
import ToastViewport from "@/components/ToastViewport";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sift",
  description: "Save, organize, and cook from your favorite recipes.",
};

// Applies the saved theme before first paint so switching themes doesn't
// cause a light/dark flash on reload.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('sift_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

/**
 * Root layout: wires up Theme/Auth/Toast providers (in that order, since Toast
 * and the nav depend on nothing but Auth needs Theme's class applied first)
 * around the shared `Navbar`/`ToastViewport` chrome. Injects
 * `NO_FLASH_THEME_SCRIPT` into `<head>` so the persisted theme is applied
 * before React hydrates, avoiding a light/dark flash on load.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 dark:from-[#17141f] dark:via-[#1c1826] dark:to-[#1a1420]">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ToastViewport />
              <Navbar />
              <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
                {children}
              </main>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
