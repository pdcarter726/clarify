"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Gate for pages that require a signed-in user: shows a loading state while
 * `useAuth` resolves the session, redirects to `/login` once resolved with
 * no user, and otherwise renders `children`.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-zinc-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
