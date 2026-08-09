/** "implementation-plan.md" → "implementation-plan". */
export function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Creating markdown shouldn't require typing markdown's extension. */
export function ensureMd(name: string): string {
  return name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
}

/** Validate a new file or folder name against its future siblings.
 * Returns an error message, or null when the name is usable. */
export function validateName(raw: string, siblings: readonly string[]): string | null {
  const name = raw.trim();
  if (name === "") return "Name can't be empty";
  if (name.includes("/")) return "Name can't contain /";
  if (name.startsWith(".")) return "Hidden files aren't shown in kladd";
  const lower = name.toLowerCase();
  if (siblings.some((s) => s.toLowerCase() === lower)) return "Already exists";
  return null;
}
