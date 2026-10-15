import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/lib/toast-context";
import Navbar from "@/components/Navbar";
import ToastViewport from "@/components/ToastViewport";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clarify",
  description: "Save, organize, and cook from your favorite recipes.",
};

// Applies the saved theme before first paint so switching themes doesn't
// cause a light/dark flash on reload.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('clarify_theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

/**
 * Root layout: wires up Theme/Auth/Toast providers (in that order, since Toast
 * and the nav depend on nothing but Auth needs Theme's class applied first)
 * around the shared `Navbar`/`ToastViewport` chrome. Pages own their own
 * `<main>` and width, since the landing and login layouts differ from the app
 * pages. Injects `NO_FLASH_THEME_SCRIPT` into `<head>` so the persisted theme
 * is applied before React hydrates, avoiding a light/dark flash on load.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ToastViewport />
              <Navbar />
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
