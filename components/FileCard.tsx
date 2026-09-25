"use client";

import { memo, useMemo } from "react";
import hljs from "highlight.js/lib/common";
import { CHAR_W, GUTTER, type PlacedFile } from "@/lib/layout";
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


function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(path: string, code: string): string {
  const ext = extensionOf(path);
  const lang = FILENAME_LANGS[ext] ?? (hljs.getLanguage(ext) ? ext : undefined);
  try {
    return lang ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : escapeHtml(code);
  } catch {
    return escapeHtml(code);
  }
}

/**
 * Splits highlighted HTML into one fragment per source line. Tokens spanning
 * several lines (block comments, template strings) are closed at each line
 * end and reopened on the next line so every fragment is well-formed.
 */
function splitLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";
  for (const token of html.match(/<span[^>]*>|<\/span>|\n|[^<\n]+/g) ?? []) {
    if (token === "\n") {
      lines.push(current + "</span>".repeat(open.length));
      current = open.join("");
    } else {
      if (token.startsWith("<span")) open.push(token);
      else if (token === "</span>") open.pop();
      current += token;
    }
  }
  lines.push(current + "</span>".repeat(open.length));
  return lines;
}

/**
 * Inserts "\n" into a highlighted line at the given source-text offsets.
 * Offsets count characters of the original line, so tags are skipped and each
 * HTML entity (`&lt;`, `&amp;`, …) counts as the single character it encodes.
 */
function insertBreaks(html: string, offsets: number[]): string {
  if (offsets.length === 0) return html;
  let out = "";
  let pos = 0;
  let next = 0;
  for (let i = 0; i < html.length; ) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i) + 1;
      out += html.slice(i, end);
      i = end;
      continue;
    }
    if (next < offsets.length && pos === offsets[next]) {
      out += "\n";
      next++;
    }
    const len = html[i] === "&" ? html.indexOf(";", i) + 1 - i : 1;
    out += html.slice(i, i + len);
    i += len;
    pos++;
  }
  return out;
}

/** Renders the code body as a grid of rows: line number + word-wrapped line. */
function renderRows(file: PlacedFile): string {
  const cached = rowsCache.get(file);
  if (cached !== undefined) return cached;
  const lines = splitLines(highlight(file.path, file.text));
  let html = "";
  for (let i = 0; i < lines.length; i++) {
    html += `<div class="ln">${i + 1}</div><div class="lc">${insertBreaks(lines[i], file.wraps[i] ?? [])}</div>`;
  }
  if (file.hiddenLines > 0) {
    html += `<div class="ln"></div><div class="lc file-card__more">… ${file.hiddenLines} more lines</div>`;
  }
  rowsCache.set(file, html);
  return html;
}

const rowsCache = new WeakMap<PlacedFile, string>();

type Props = { file: PlacedFile; detailed: boolean; onFocus: (file: PlacedFile) => void };

export const FileCard = memo(function FileCard({ file, detailed, onFocus }: Props) {
  const accent = accentFor(file.path);
  const style = { left: file.x, top: file.y, width: file.w, height: file.h, "--accent": accent } as React.CSSProperties;

  const rows = useMemo(() => (detailed ? renderRows(file) : null), [detailed, file]);

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
      {rows !== null ? (
        <div
          className="file-card__code hljs"
          style={{ gridTemplateColumns: `${GUTTER}px ${file.cols * CHAR_W}px` }}
          dangerouslySetInnerHTML={{ __html: rows }}
        />
      ) : (
        <div className="file-card__placeholder">
          <span style={{ fontSize: `min(calc(15px * var(--inv)), ${file.w / 9}px)` }}>{file.name}</span>
        </div>
      )}
    </div>
  );
});
