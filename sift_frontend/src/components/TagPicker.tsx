"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { tagsApi, type Tag } from "@/lib/api";
import { inputClass, labelClass } from "./ui";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Free-text tag input with autocomplete suggestions, used by `RecipeForm`.
 * Fetches the user's full tag list from `GET /tags` (via `tagsApi.list`) on
 * mount to populate suggestions; selection itself is controlled (`value`/
 * `onChange`) and new tag names are created lazily by the backend on submit,
 * not here. Enter or "," commits the current draft as a tag.
 */
export default function TagPicker({ value, onChange }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    tagsApi
      .list()
      .then(setAllTags)
      .catch(() => setAllTags([]));
  }, []);

  const normalizedSelected = value.map((t) => t.toLowerCase());

  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (normalizedSelected.includes(trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    }
  }

  const suggestions = allTags.filter((tag) => !normalizedSelected.includes(tag.name.toLowerCase()));

  return (
    <div>
      <label className={labelClass} htmlFor="tag-picker-input">
        Tags
      </label>

      {value.length > 0 && (
        <div className="mb-2 mt-1.5 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-400/15 dark:text-teal-200"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="text-teal-600 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id="tag-picker-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        placeholder="Type a tag and press Enter (e.g. weeknight)"
        className={`${inputClass} mt-1`}
      />

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="rounded-full border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-600 transition-colors hover:border-teal-400 hover:bg-teal-50 dark:border-teal-400/20 dark:text-teal-400 dark:hover:bg-teal-400/10"
            >
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
