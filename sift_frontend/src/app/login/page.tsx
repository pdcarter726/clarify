"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, passwordError } from "@/lib/api";
import { inputClass, labelClass, primaryButtonClass, cardClass } from "@/components/ui";

type Tab = "login" | "signup";

/**
 * Combined login/signup form; initial tab is driven by the `?tab=signup`
 * query param. On signup, validates the password client-side (`passwordError`)
 * and requires a matching confirmation before calling `useAuth().signup`;
 * both flows redirect to `/recipes` on success.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "signup" ? "signup" : "login";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login, signup } = useAuth();
  const { showMessage } = useToast();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (tab === "signup") {
      const pwErr = passwordError(password);
      if (pwErr) return showMessage(pwErr);
      if (password !== confirmPassword) return showMessage("Passwords do not match.");
    }

    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
        showMessage("Logged in.", "success");
      } else {
        await signup(email, password);
        showMessage("Account created.", "success");
      }
      router.push("/recipes");
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <div className={cardClass}>
        <div className="mb-5 flex gap-1 rounded-xl bg-orange-50 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
              tab === "login"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
              tab === "signup"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} mt-1`}
            />
            {tab === "signup" && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                At least 8 characters, with uppercase, lowercase, a number, and a special
                character.
              </p>
            )}
          </div>
          {tab === "signup" && (
            <div>
              <label className={labelClass} htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          )}
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Wraps `LoginForm` in `Suspense` since it reads the `tab` query param via `useSearchParams`. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
