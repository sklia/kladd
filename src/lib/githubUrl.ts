/** Converts a git remote URL to a browsable GitHub repo URL. Understands
 * the three forms GitHub remotes take: https, scp-like (git@), and ssh://.
 * Returns null for non-GitHub remotes; "Open on GitHub" simply doesn't
 * appear for them. */
export function githubUrl(remote: string): string | null {
  const trimmed = remote.trim().replace(/\.git$/, "");
  const https = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.exec(trimmed);
  if (https) return trimmed;
  const scp = /^git@github\.com:([\w.-]+)\/([\w.-]+)$/.exec(trimmed);
  if (scp) return `https://github.com/${scp[1]}/${scp[2]}`;
  const ssh = /^ssh:\/\/git@github\.com\/([\w.-]+)\/([\w.-]+)$/.exec(trimmed);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  return null;
}
