"use client";

import { memo, useMemo } from "react";
import hljs from "highlight.js/lib/common";
import { MAX_LINES, type PlacedFile } from "@/lib/layout";
import { extensionOf } from "@/lib/textFiles";

const FILENAME_LANGS: Record<string, string> = {
  makefile: "makefile",
  gnumakefile: "makefile",
  dockerfile: "bash",
  gemfile: "ruby",
  rakefile: "ruby",
};

// Accent colour per file type, used on the card header dot.
const EXT_COLORS: Record<string, string> = {
  ts: "#3b82f6", tsx: "#3b82f6", mts: "#3b82f6", js: "#facc15", jsx: "#facc15", mjs: "#facc15",
  py: "#60a5fa", rs: "#fb923c", go: "#22d3ee", rb: "#f43f5e", java: "#f97316", kt: "#a78bfa",
  swift: "#fb7185", c: "#94a3b8", h: "#94a3b8", cpp: "#818cf8", cs: "#a855f7", php: "#8b5cf6",
  css: "#38bdf8", scss: "#ec4899", html: "#f97316", vue: "#34d399", svelte: "#fb923c",
  json: "#fbbf24", yml: "#f87171", yaml: "#f87171", toml: "#d97706", md: "#e2e8f0",
  mdx: "#e2e8f0", sh: "#4ade80", sql: "#f472b6",
};

export function accentFor(path: string) {
  return EXT_COLORS[extensionOf(path)] ?? "#64748b";
}

const highlightCache = new Map<string, string>();

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(path: string, code: string): string {
  const cached = highlightCache.get(path);
  if (cached !== undefined) return cached;
  const ext = extensionOf(path);
  const lang = FILENAME_LANGS[ext] ?? (hljs.getLanguage(ext) ? ext : undefined);
  let html: string;
  try {
    html = lang ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : escapeHtml(code);
  } catch {
    html = escapeHtml(code);
  }
  highlightCache.set(path, html);
  return html;
}

type Props = { file: PlacedFile; detailed: boolean; onFocus: (file: PlacedFile) => void };

export const FileCard = memo(function FileCard({ file, detailed, onFocus }: Props) {
  const accent = accentFor(file.path);
  const style = { left: file.x, top: file.y, width: file.w, height: file.h, "--accent": accent } as React.CSSProperties;

  const body = useMemo(() => {
    if (!detailed) return null;
    const lines = file.content.split("\n");
    const shown = lines.slice(0, MAX_LINES).join("\n");
    const numbers = Array.from({ length: Math.min(lines.length, MAX_LINES) }, (_, i) => i + 1).join("\n");
    return { html: highlight(file.path, shown), numbers, hidden: Math.max(0, lines.length - MAX_LINES) };
  }, [detailed, file.path, file.content]);

  return (
    <div
      className={`file-card ${detailed ? "" : "file-card--far"}`}
      style={style}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onFocus(file);
      }}
    >
      <div className="file-card__header">
        <span className="file-card__dot" />
        <span className="file-card__name">{file.name}</span>
        <span className="file-card__meta">{file.lineCount} lines</span>
      </div>
      {body ? (
        <div className="file-card__body">
          <pre className="file-card__gutter">{body.numbers}</pre>
          <pre className="file-card__code hljs">
            <code dangerouslySetInnerHTML={{ __html: body.html }} />
            {body.hidden > 0 && <span className="file-card__more">{`\n… ${body.hidden} more lines`}</span>}
          </pre>
        </div>
      ) : (
        <div className="file-card__placeholder">
          <span style={{ fontSize: `min(calc(15px * var(--inv)), ${file.w / 9}px)` }}>{file.name}</span>
        </div>
      )}
    </div>
  );
});
