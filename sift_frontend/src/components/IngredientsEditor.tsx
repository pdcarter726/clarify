"use client";

import { inputClass } from "./ui";

export interface IngredientDraft {
  name: string;
  quantity: string;
  unit: string;
}

interface IngredientsEditorProps {
  ingredients: IngredientDraft[];
  onChange: (ingredients: IngredientDraft[]) => void;
}

/**
 * Controlled editable list of ingredient rows (name/quantity/unit) used by
 * the recipe form; it holds no state itself, delegating every add/edit/remove
 * to the parent via `onChange`.
 */
export default function IngredientsEditor({ ingredients, onChange }: IngredientsEditorProps) {
  function updateRow(index: number, patch: Partial<IngredientDraft>) {
    onChange(ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...ingredients, { name: "", quantity: "", unit: "" }]);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ingredients</span>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
        >
          + Add ingredient
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {ingredients.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              placeholder="name"
              required
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              className={`${inputClass} flex-[3]`}
            />
            <input
              type="text"
              placeholder="qty"
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              className={`${inputClass} flex-1`}
            />
            <input
              type="text"
              placeholder="unit"
              value={row.unit}
              onChange={(e) => updateRow(index, { unit: e.target.value })}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="Remove ingredient"
              className="rounded-lg px-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>
        ))}
        {ingredients.length === 0 && (
          <p className="text-sm text-zinc-400">No ingredients yet.</p>
        )}
      </div>
    </div>
  );
}
