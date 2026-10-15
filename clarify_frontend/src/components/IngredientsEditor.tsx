"use client";

import Icon from "./Icon";

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
    <section className="card flex flex-col gap-4 p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Ingredients</h2>
        <button type="button" onClick={addRow} className="btn">
          <Icon name="plus" />
          Add ingredient
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {ingredients.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              aria-label={`Ingredient ${index + 1} name`}
              placeholder="name"
              required
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              className="field w-auto flex-[1_1_220px]"
            />
            <input
              type="text"
              aria-label={`Ingredient ${index + 1} quantity`}
              placeholder="qty"
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              className="field w-[84px] flex-none"
            />
            <input
              type="text"
              aria-label={`Ingredient ${index + 1} unit`}
              placeholder="unit"
              value={row.unit}
              onChange={(e) => updateRow(index, { unit: e.target.value })}
              className="field w-[132px] flex-none"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove ingredient ${index + 1}`}
              className="rm-btn"
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
        {ingredients.length === 0 && <p className="text-[15px] text-muted">No ingredients yet.</p>}
      </div>
    </section>
  );
}
