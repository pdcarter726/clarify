"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, PASSWORD_HINT, passwordError } from "@/lib/api";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";

type Tab = "login" | "signup";

const PITCH = ["Import from any URL", "Tag, filter, and search", "Scale servings and cook hands-free"];

/**
 * Combined login/signup form on a split-screen layout; initial tab is driven
 * by the `?tab=signup` query param. On signup, validates the password
 * client-side (`passwordError`) and requires a matching confirmation before
 * calling `useAuth().signup`; both flows redirect to `/recipes` on success.
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

  const signupTab = tab === "signup";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (signupTab) {
      const pwErr = passwordError(password);
      if (pwErr) return showMessage(pwErr);
      if (password !== confirmPassword) return showMessage("Passwords do not match.");
    }

    setSubmitting(true);
    try {
      if (signupTab) {
        await signup(email, password);
        showMessage("Account created.", "success");
      } else {
        await login(email, password);
        showMessage("Logged in.", "success");
      }
      router.push("/recipes");
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-wrap">
      <div className="flex flex-[1_1_480px] flex-col justify-between gap-16 bg-accent px-12 py-10 text-on-accent max-sm:px-6">
        <div className="[&_svg_rect]:fill-(--on-accent) [&_svg_circle]:stroke-(--accent)">
          <Logo />
        </div>
        <div className="flex max-w-[30em] flex-col gap-7">
          <h2 className="disp text-[clamp(34px,4vw,52px)] font-bold leading-[1.08] [text-wrap:balance]">
            Your recipes, ready when you are.
          </h2>
          <ul className="flex flex-col gap-3.5 text-[17px] leading-snug">
            {PITCH.map((line) => (
              <li key={line} className="flex items-center gap-3">
                <Icon name="check" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-[1_1_480px] flex-col px-12 py-8 max-sm:px-6">
        <main className="flex flex-1 items-center justify-center py-6">
          <div className="flex w-full max-w-[400px] flex-col gap-7">
            <div className="relative flex gap-1 rounded-xl bg-sunk p-1">
              <span
                className="seg-pill"
                aria-hidden="true"
                style={{ transform: `translateX(${signupTab ? "calc(100% + 4px)" : "0"})` }}
              />
              <button
                type="button"
                className={`seg ${!signupTab ? "seg-on" : ""}`}
                aria-pressed={!signupTab}
                onClick={() => setTab("login")}
              >
                Log in
              </button>
              <button
                type="button"
                className={`seg ${signupTab ? "seg-on" : ""}`}
                aria-pressed={signupTab}
                onClick={() => setTab("signup")}
              >
                Sign up
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <h1 className="disp text-[32px] font-bold leading-tight">
                {signupTab ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-[15px] text-muted">
                {signupTab
                  ? "Start saving recipes in under a minute."
                  : "Log in to open your recipe collection."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-1.5">
                <label className="lbl" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="lbl" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete={signupTab ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                />
                <p
                  aria-hidden={!signupTab}
                  className={`text-[13px] leading-normal text-muted transition-opacity duration-200 ${
                    signupTab ? "opacity-100" : "invisible opacity-0"
                  }`}
                >
                  {PASSWORD_HINT}
                </p>
              </div>
              <div
                aria-hidden={!signupTab}
                className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
                  signupTab ? "opacity-100" : "invisible opacity-0"
                }`}
              >
                <label className="lbl" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required={signupTab}
                  disabled={!signupTab}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="field"
                />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary min-h-[52px] text-base">
                {submitting ? "Please wait…" : signupTab ? "Create account" : "Log in"}
              </button>
            </form>
          </div>
        </main>
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
