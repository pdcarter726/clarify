"use client";

import { useEffect, useState, type FormEvent } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useToast } from "@/lib/toast-context";
import { ApiError, tagsApi, type Tag } from "@/lib/api";

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
    <main className="wrap flex-1 pb-20 pt-10">
      <div className="flex max-w-[680px] flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="disp text-4xl font-bold leading-[1.1]">Manage tags</h1>
          <p className="text-[15px] text-muted">
            Deleting a tag removes it from every recipe that uses it.
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-2.5">
          <label htmlFor="newtag" className="sr-only-label">
            New tag name
          </label>
          <input
            id="newtag"
            type="text"
            required
            placeholder="New tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="field min-h-[52px] w-auto flex-[1_1_240px]"
          />
          <button type="submit" disabled={creating} className="btn btn-primary min-h-[52px] px-7">
            Add tag
          </button>
        </form>

        {loading ? (
          <div className="sk h-40 rounded-2xl" role="status" aria-label="Loading tags" />
        ) : tags.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-base text-muted">
            No tags yet.
          </div>
        ) : (
          <ul className="card px-5 py-1">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-line py-3 last:border-b-0"
              >
                {editingId === tag.id ? (
                  <>
                    <label htmlFor="rename" className="sr-only-label">
                      Rename tag
                    </label>
                    <input
                      id="rename"
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="field w-auto flex-[1_1_160px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(tag.id)}
                      disabled={savingId === tag.id}
                      className="btn btn-primary"
                    >
                      Save
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-[1_1_160px] text-base font-semibold">#{tag.name}</span>
                    <button type="button" onClick={() => startEdit(tag)} className="btn">
                      Rename
                    </button>
                    <button type="button" onClick={() => handleDelete(tag)} className="btn btn-danger">
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
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
