"use client";

import { useEffect, useState, type FormEvent } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useToast } from "@/lib/toast-context";
import { ApiError, tagsApi, type Tag } from "@/lib/api";
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";

/**
 * CRUD management UI for the user's tags (`tagsApi`), with inline rename
 * (one row editable at a time via `editingId`) and delete (guarded by a
 * native `confirm()`, since deleting a tag detaches it from every recipe).
 */
function TagsPageContent() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const { showMessage } = useToast();

  async function loadTags() {
    setLoading(true);
    try {
      const data = await tagsApi.list();
      setTags(data);
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not load tags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Only async work runs synchronously here; setState calls happen after
    // an await, so this isn't the cascading-render pattern the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await tagsApi.create(newTagName);
      setNewTagName("");
      showMessage("Tag created.", "success");
      await loadTags();
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not create tag.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditingName(tag.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleRename(id: number) {
    setSavingId(id);
    try {
      await tagsApi.update(id, editingName);
      showMessage("Tag renamed.", "success");
      cancelEdit();
      await loadTags();
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not rename tag.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(tag: Tag) {
    if (
      !confirm(
        `Delete the "${tag.name}" tag? This removes it from every recipe that uses it.`,
      )
    ) {
      return;
    }
    try {
      await tagsApi.remove(tag.id);
      showMessage("Tag deleted.", "success");
      await loadTags();
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not delete tag.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Manage tags</h1>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          required
          placeholder="New tag name"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={creating} className={primaryButtonClass}>
          Add tag
        </button>
      </form>

      <div className={cardClass}>
        {loading ? (
          <p className="py-4 text-center text-sm text-zinc-400">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">No tags yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-orange-100 dark:divide-white/10">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-2 py-2.5">
                {editingId === tag.id ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(tag.id)}
                      disabled={savingId === tag.id}
                      className={secondaryButtonClass}
                    >
                      Save
                    </button>
                    <button type="button" onClick={cancelEdit} className={secondaryButtonClass}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-200">
                      #{tag.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      className={secondaryButtonClass}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag)}
                      className={dangerButtonClass}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Tag management page; gated behind `ProtectedRoute`. */
export default function TagsPage() {
  return (
    <ProtectedRoute>
      <TagsPageContent />
    </ProtectedRoute>
  );
}
