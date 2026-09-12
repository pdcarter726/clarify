"use client";

import type { Tag } from "@/lib/api";

interface TagFilterBarProps {
  tags: Tag[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}

/**
 * Row of toggleable tag pills for filtering the recipe list; renders nothing
 * if there are no tags. Purely controlled — selection state lives in the
 * parent, reached via `onToggle`/`onClear`.
 */
export default function TagFilterBar({ tags, selected, onToggle, onClear }: TagFilterBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Filter by tag:
      </span>
      {tags.map((tag) => {
        const active = selected.includes(tag.name);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.name)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-teal-600 text-white"
                : "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-white/5 dark:text-teal-300 dark:hover:bg-white/10"
            }`}
          >
            #{tag.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-xs font-medium text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}
