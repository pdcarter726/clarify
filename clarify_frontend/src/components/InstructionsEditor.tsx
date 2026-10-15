"use client";

import Icon from "./Icon";

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
    <section className="card flex flex-col gap-4 p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Instructions</h2>
        <button type="button" onClick={addRow} className="btn">
          <Icon name="plus" />
          Add step
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {instructions.map((row, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className="mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hi text-sm font-bold text-on-hi">
              {index + 1}
            </span>
            <textarea
              aria-label={`Step ${index + 1}`}
              placeholder="step description"
              required
              value={row.text}
              onChange={(e) => updateRow(index, e.target.value)}
              className="field min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove step ${index + 1}`}
              className="rm-btn mt-0.5"
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
        {instructions.length === 0 && <p className="text-[15px] text-muted">No steps yet.</p>}
      </div>
    </section>
  );
}
