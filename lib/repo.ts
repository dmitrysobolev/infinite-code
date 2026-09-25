export type RepoRef = { owner: string; repo: string; ref?: string };

/**
 * Accepts "owner/repo", "github.com/owner/repo", full URLs, ".git" suffixes
 * and "/tree/<branch>" links.
 */
export function parseRepoInput(input: string): RepoRef | null {
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/^git@github\.com:/, "");
  s = s.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  s = s.replace(/[?#].*$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  const valid = /^[A-Za-z0-9_.-]+$/;
  if (!valid.test(owner) || !valid.test(repo)) return null;
  const ref = parts[2] === "tree" && parts[3] ? parts[3] : undefined;
  return { owner, repo, ref };
}
