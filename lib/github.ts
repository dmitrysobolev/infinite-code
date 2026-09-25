import { isTextPath } from "./textFiles";

export const MAX_FILE_BYTES = 150_000;
export const MAX_FILES = 1500;

export type RepoFile = { path: string; size: number };

export type RepoTree = {
  owner: string;
  repo: string;
  ref: string;
  description: string | null;
  files: RepoFile[];
  skipped: number;
  truncated: boolean;
};

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    if (res.status === 404) throw new GitHubError("Repository or branch not found (or it is private).", 404);
    if (res.status === 403 || res.status === 429) {
      throw new GitHubError("GitHub API rate limit reached. Set GITHUB_TOKEN in .env.local to raise it.", res.status);
    }
    throw new GitHubError(`GitHub API error ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchRepoTree(owner: string, repo: string, ref?: string): Promise<RepoTree> {
  const meta = await gh<{ default_branch: string; description: string | null }>(`/repos/${owner}/${repo}`);
  const branch = ref || meta.default_branch;
  const tree = await gh<{
    tree: { path: string; type: string; size?: number }[];
    truncated: boolean;
  }>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);

  const blobs = tree.tree.filter((e) => e.type === "blob");
  const text = blobs
    .filter((e) => isTextPath(e.path) && (e.size ?? 0) > 0 && (e.size ?? 0) <= MAX_FILE_BYTES)
    .map((e) => ({ path: e.path, size: e.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const files = text.slice(0, MAX_FILES);
  return {
    owner,
    repo,
    ref: branch,
    description: meta.description,
    files,
    skipped: blobs.length - files.length,
    truncated: tree.truncated || text.length > MAX_FILES,
  };
}
