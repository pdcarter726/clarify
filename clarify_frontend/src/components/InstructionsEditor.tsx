"use client";

import { inputClass } from "./ui";

export interface InstructionDraft {
  text: string;
}

interface InstructionsEditorProps {
  instructions: InstructionDraft[];
  onChange: (instructions: InstructionDraft[]) => void;
}

/**
 * Controlled editable list of numbered instruction steps used by the recipe
 * form; it holds no state itself, delegating every add/edit/remove to the
 * parent via `onChange`.
 */
export default function InstructionsEditor({ instructions, onChange }: InstructionsEditorProps) {
  function updateRow(index: number, text: string) {
    onChange(instructions.map((row, i) => (i === index ? { text } : row)));
  }

  function removeRow(index: number) {
    onChange(instructions.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...instructions, { text: "" }]);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Instructions</span>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
        >
          + Add step
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {instructions.map((row, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-sm text-zinc-400">
              {index + 1}.
            </span>
            <input
              type="text"
              placeholder="step description"
              required
              value={row.text}
              onChange={(e) => updateRow(index, e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="Remove step"
              className="rounded-lg px-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>
        ))}
        {instructions.length === 0 && (
          <p className="text-sm text-zinc-400">No steps yet.</p>
        )}
      </div>
    </div>
  );
}
