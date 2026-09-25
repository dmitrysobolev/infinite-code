"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RepoTree } from "@/lib/github";
import { computeLayout, type SourceFile } from "@/lib/layout";
import { InfiniteCanvas } from "./InfiniteCanvas";

const CONCURRENCY = 16;

type State =
  | { status: "tree" }
  | { status: "files"; tree: RepoTree; done: number }
  | { status: "ready"; tree: RepoTree; files: SourceFile[] }
  | { status: "error"; message: string };

function rawUrl(tree: RepoTree, path: string) {
  const enc = (s: string) => s.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${tree.owner}/${tree.repo}/${enc(tree.ref)}/${enc(path)}`;
}

export function RepoView({ owner, repo, gitRef }: { owner: string; repo: string; gitRef?: string }) {
  const [state, setState] = useState<State>({ status: "tree" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qs = new URLSearchParams({ owner, repo, ...(gitRef ? { ref: gitRef } : {}) });
      const res = await fetch(`/api/repo?${qs}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) return setState({ status: "error", message: data.error ?? "Failed to load repository" });
      const tree = data as RepoTree;
      if (tree.files.length === 0) return setState({ status: "error", message: "No text files found in this repository." });
      setState({ status: "files", tree, done: 0 });

      const results: (SourceFile | null)[] = new Array(tree.files.length).fill(null);
      let next = 0;
      let done = 0;
      const worker = async () => {
        while (!cancelled && next < tree.files.length) {
          const i = next++;
          const { path } = tree.files[i];
          try {
            const r = await fetch(rawUrl(tree, path));
            if (r.ok) {
              const content = await r.text();
              // Skip anything that turned out to be binary.
              if (!content.includes("\u0000")) results[i] = { path, content: content.replace(/\r\n/g, "\n") };
            }
          } catch {
            /* ignore individual file failures */
          }
          done++;
          if (!cancelled && (done % 8 === 0 || done === tree.files.length)) {
            setState({ status: "files", tree, done });
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      // The layout measures glyph widths, so the code font must be ready first.
      const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono");
      await document.fonts.load(`12px ${mono}`).catch(() => {});
      if (cancelled) return;
      setState({ status: "ready", tree, files: results.filter((f): f is SourceFile => f !== null) });
    })().catch((e) => !cancelled && setState({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [owner, repo, gitRef]);

  const layout = useMemo(
    () => (state.status === "ready" ? computeLayout(state.files, repo) : null),
    [state, repo]
  );

  const tree = state.status === "files" || state.status === "ready" ? state.tree : null;

  return (
    <main className="repo-view">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand__mark">∞</span> Infinite Code
        </Link>
        <div className="topbar__repo">
          <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noreferrer">
            {owner}/<strong>{repo}</strong>
          </a>
          {tree && <span className="pill">{tree.ref}</span>}
          {state.status === "ready" && <span className="pill">{state.files.length} files</span>}
          {tree?.truncated && <span className="pill pill--warn" title="Very large repository — only part of it is shown">partial</span>}
        </div>
      </header>

      {layout && <InfiniteCanvas layout={layout} />}

      {state.status !== "ready" && (
        <div className="status">
          {state.status === "error" ? (
            <>
              <p className="status__error">{state.message}</p>
              <Link href="/" className="button">Try another repository</Link>
            </>
          ) : (
            <>
              <div className="spinner" />
              <p>
                {state.status === "tree"
                  ? "Reading repository tree…"
                  : `Fetching files ${state.done} / ${state.tree.files.length}`}
              </p>
              {state.status === "files" && (
                <div className="progress">
                  <div className="progress__bar" style={{ width: `${(state.done / state.tree.files.length) * 100}%` }} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
