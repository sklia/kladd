import { useState } from "react";

/** Inline input row for rename and create: Enter commits, Esc cancels.
 * Validation errors show under the input; no dialogs. */
export function TreeEditRow({
  initial,
  depth,
  error,
  onCommit,
  onCancel,
}: {
  initial: string;
  depth: number;
  error?: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <div className="tree-edit" style={{ paddingLeft: `${depth * 0.85 + 0.5}rem` }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={onCancel}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit(value);
          else if (e.key === "Escape") onCancel();
        }}
      />
      {error !== undefined && <span className="tree-edit-error">{error}</span>}
    </div>
  );
}
