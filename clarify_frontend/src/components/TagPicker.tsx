"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { tagsApi, type Tag } from "@/lib/api";
import Icon from "./Icon";

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
    <section className="card flex flex-col gap-4 p-7">
      <h2 className="text-lg font-bold">
        <label htmlFor="tag-picker-input">Tags</label>
      </h2>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="tagpill">
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="rm-btn h-8 w-8 flex-none rounded-full text-inherit"
              >
                <Icon name="x" size={16} />
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
        className="field"
      />

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((tag) => (
            <button key={tag.id} type="button" onClick={() => addTag(tag.name)} className="tagchip">
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
