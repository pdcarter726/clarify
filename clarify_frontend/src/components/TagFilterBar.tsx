"use client";

import type { Tag } from "@/lib/api";

interface TagFilterBarProps {
  tags: Tag[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}

/**
 * Row of toggleable tag chips for filtering the recipe list; renders nothing
 * if there are no tags. Purely controlled — selection state lives in the
 * parent, reached via `onToggle`/`onClear`.
 */
export default function TagFilterBar({ tags, selected, onToggle, onClear }: TagFilterBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
      {tags.map((tag) => {
        const active = selected.includes(tag.name);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tag.name)}
            className={`tagchip ${active ? "tagchip-on" : ""}`}
          >
            {tag.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-9 px-2 text-sm font-semibold text-accent hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
