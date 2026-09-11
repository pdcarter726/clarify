"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, passwordError, usersApi } from "@/lib/api";
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Account</h1>

      <form onSubmit={handleUpdate} className={`${cardClass} flex flex-col gap-4`}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          Update profile
        </h2>
        <div>
          <label className={labelClass} htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="account-password">
            New password
          </label>
          <input
            id="account-password"
            type="password"
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="account-current-password">
            Current password
          </label>
          <input
            id="account-current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <button type="submit" disabled={savingProfile} className={primaryButtonClass}>
          {savingProfile ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form onSubmit={handleDelete} className={`${cardClass} flex flex-col gap-4`}>
        <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This permanently deletes your account and every saved recipe.
        </p>
        <div>
          <label className={labelClass} htmlFor="delete-current-password">
            Current password
          </label>
          <input
            id="delete-current-password"
            type="password"
            required
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <button type="submit" disabled={deleting} className={dangerButtonClass}>
          {deleting ? "Deleting…" : "Delete account"}
        </button>
      </form>
    </div>
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
