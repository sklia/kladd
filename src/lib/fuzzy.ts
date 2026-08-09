// Subsequence fuzzy match. Higher score is better; null means no match.
// Bonuses: consecutive hits, hits after a separator or camelCase bump,
// hits in the file name. Where the match starts costs nothing; only gaps
// between hits do, so deep paths compete fairly with shallow ones.
export function fuzzyScore(query: string, target: string): number | null {
  if (query === "") return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let ti = 0;
  let lastHit = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return null;
    if (found === lastHit + 1) score += 4;
    if (found === 0 || "/-_. ".includes(t[found - 1])) score += 8;
    else if (target[found] !== t[found]) score += 6; // camelCase boundary
    if (qi > 0) score -= (found - ti) * 0.1; // gap penalty between hits only
    lastHit = found;
    ti = found + 1;
  }
  // Matches near the end (file name, not directory) win ties.
  score += lastHit / t.length;
  return score;
}

export function fuzzyFilter(query: string, targets: readonly string[], limit = 50): string[] {
  const scored: [number, string][] = [];
  for (const target of targets) {
    const score = fuzzyScore(query, target);
    if (score !== null) scored.push([score, target]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, target]) => target);
}
