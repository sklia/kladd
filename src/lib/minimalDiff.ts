export interface ChangeSpan {
  from: number;
  to: number;
  insert: string;
}

/** The single change span between two texts, by trimming the common prefix
 * and suffix. Null when equal. Positions are UTF-16 code units, matching
 * CodeMirror. Dispatching this as one change lets CodeMirror map the
 * selection and scroll position through an external reload instead of
 * jumping. */
export function minimalDiff(oldText: string, newText: string): ChangeSpan | null {
  if (oldText === newText) return null;
  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { from: start, to: oldEnd, insert: newText.slice(start, newEnd) };
}
