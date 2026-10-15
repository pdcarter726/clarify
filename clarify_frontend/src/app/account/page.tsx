"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import Icon from "@/components/Icon";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, passwordError, usersApi } from "@/lib/api";

/**
 * Profile update and account deletion forms. Both actions require
 * re-entering the current password, matching the backend's confirmation
 * requirement (`usersApi.update`/`usersApi.remove`). Deletion also confirms
 * via a native `confirm()` dialog before calling the API, then logs out and
 * redirects to `/login`.
 */
function AccountContent() {
  const { user, logout, refreshUser } = useAuth();
  const { showMessage } = useToast();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (password) {
      const pwErr = passwordError(password);
      if (pwErr) return showMessage(pwErr);
    }

    setSavingProfile(true);
    try {
      await usersApi.update({
        email: email !== user?.email ? email : undefined,
        password: password || undefined,
        currentPassword,
      });
      setPassword("");
      setCurrentPassword("");
      showMessage("Account updated.", "success");
      await refreshUser();
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not update account.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!confirm("Delete your account and all recipes? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await usersApi.remove(deletePassword);
      showMessage("Account deleted.", "success");
      logout();
      router.push("/login");
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not delete account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="wrap flex-1 pb-20 pt-10">
      <div className="flex max-w-[680px] flex-col gap-7">
        <h1 className="disp text-4xl font-bold leading-[1.1]">Account</h1>

        <section className="card flex flex-wrap items-center justify-between gap-5 p-7">
          <div className="flex flex-[1_1_220px] flex-col gap-1.5">
            <h2 className="text-lg font-bold">Appearance</h2>
            <p className="text-[15px] leading-normal text-muted">
              Choose a light or dark theme for Clarify.
            </p>
          </div>
          <div
            role="group"
            aria-label="Theme"
            className="flex min-w-[240px] flex-[0_1_280px] gap-1 rounded-xl bg-sunk p-1"
          >
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
              className={`seg seg-static ${theme === "light" ? "seg-on" : ""}`}
            >
              <Icon name="sun" size={18} />
              Light
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
              className={`seg seg-static ${theme === "dark" ? "seg-on" : ""}`}
            >
              <Icon name="moon" size={18} />
              Dark
            </button>
          </div>
        </section>

        <section className="card flex flex-col gap-[22px] p-7">
          <h2 className="text-lg font-bold">Update profile</h2>
          <form onSubmit={handleUpdate} className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <label className="lbl" htmlFor="account-email">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="lbl" htmlFor="account-password">
                New password
              </label>
              <input
                id="account-password"
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="lbl" htmlFor="account-current-password">
                Current password
              </label>
              <input
                id="account-current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="field"
              />
              <p className="text-[13px] text-muted">Required to save any change.</p>
            </div>
            <button type="submit" disabled={savingProfile} className="btn btn-primary self-start px-7">
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        <section className="card flex flex-col gap-[22px] border-danger-line p-7">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-bold text-danger">Delete account</h2>
            <p className="text-[15px] leading-normal text-muted">
              This permanently deletes your account and every saved recipe.
            </p>
          </div>
          <form onSubmit={handleDelete} className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <label className="lbl" htmlFor="delete-current-password">
                Current password
              </label>
              <input
                id="delete-current-password"
                type="password"
                required
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="field"
              />
            </div>
            <button type="submit" disabled={deleting} className="btn btn-danger self-start px-7">
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

/** Account settings page; gated behind `ProtectedRoute`. */
export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountContent />
    </ProtectedRoute>
  );
}
