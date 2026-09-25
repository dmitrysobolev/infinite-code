/**
 * Packs files into nested folder boxes so that everything living in the same
 * directory ends up physically grouped on the canvas.
 */

// Card geometry. These must match the file-card styles in globals.css.
export const LINE_H = 18;
export const CHAR_W = 7.2; // JetBrains Mono advance width (0.6em) @ 12px
export const GUTTER = 48;
const CARD_BORDER = 1;
const CARD_HEADER = 40;
const CODE_PAD_Y = 14;
const CODE_PAD_RIGHT = 14;
const TAB_SIZE = 4;
const MIN_COLS = 40;
const MAX_COLS = 110; // longer lines soft-wrap
const MAX_LINES = 400;
const MAX_ROWS = 600; // visual rows after wrapping
const FILE_GAP = 28;
const FOLDER_PAD = 28;
const FOLDER_GAP = 40;
const FOLDER_HEADER = 44;
const ASPECT = 1.6; // packed blocks aim for a landscape, screen-like shape

export type SourceFile = { path: string; content: string };

export type PlacedFile = {
  path: string;
  name: string;
  /** Displayed text: tabs expanded, truncated to the visible budget. */
  text: string;
  /** Characters per visual row; longer lines wrap. */
  cols: number;
  lineCount: number;
  hiddenLines: number;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
};

export type PlacedFolder = {
  path: string;
  name: string;
  fileCount: number;
  x: number;
  y: number;
  w: number;
  h: number;
  header: number;
  depth: number;
};

export type Layout = {
  files: PlacedFile[];
  folders: PlacedFolder[];
  width: number;
  height: number;
};

type Dir = { name: string; path: string; dirs: Map<string, Dir>; files: SourceFile[] };

// A node positioned relative to its parent; flattened at the end.
type Box =
  | {
      kind: "file";
      w: number;
      h: number;
      file: SourceFile;
      text: string;
      cols: number;
      lineCount: number;
      hiddenLines: number;
    }
  | {
      kind: "folder";
      w: number;
      h: number;
      header: number;
      dir: Dir | null; // null = anonymous block holding a folder's own files
      fileCount: number;
      children: Placed[];
    };
type Placed = Box & { x: number; y: number };

function buildTree(files: SourceFile[], rootName: string): Dir {
  const root: Dir = { name: rootName, path: "", dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.get(part);
      if (!next) {
        next = { name: part, path: dir.path ? `${dir.path}/${part}` : part, dirs: new Map(), files: [] };
        dir.dirs.set(part, next);
      }
      dir = next;
    }
    dir.files.push(file);
  }
  return root;
}

// Everything below U+1100 (Latin, Greek, Cyrillic, box drawing, …) is covered
// by JetBrains Mono at a fixed advance. Wider scripts (CJK, emoji) come from
// fallback fonts, so their real widths are measured once and cached.
const NARROW = /^[\u0000-ჿ]*$/;
const charWidths = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null | undefined;

function charWidth(ch: string): number {
  if (ch.charCodeAt(0) < 0x1100) return CHAR_W;
  let w = charWidths.get(ch);
  if (w === undefined) {
    if (measureCtx === undefined) {
      measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
      if (measureCtx) {
        const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mono") || "monospace";
        measureCtx.font = `12px ${family}`;
      }
    }
    w = measureCtx ? measureCtx.measureText(ch).width : CHAR_W * 2;
    charWidths.set(ch, w);
  }
  return w;
}

/** Width of a line in character columns (wide glyphs count as more than one). */
function lineColumns(line: string): number {
  if (NARROW.test(line)) return line.length;
  let w = 0;
  for (const ch of line) w += charWidth(ch);
  return w / CHAR_W;
}

/** Visual rows a line occupies when broken anywhere at `cols` columns. */
function wrappedRows(line: string, cols: number): number {
  if (NARROW.test(line)) return Math.max(1, Math.ceil(line.length / cols));
  const max = cols * CHAR_W + 0.01;
  let rows = 1;
  let w = 0;
  for (const ch of line) {
    const cw = charWidth(ch);
    if (w + cw > max) {
      rows++;
      w = cw;
    } else w += cw;
  }
  return rows;
}

function expandTabs(line: string): string {
  if (!line.includes("\t")) return line;
  let out = "";
  for (const ch of line) out += ch === "\t" ? " ".repeat(TAB_SIZE - (out.length % TAB_SIZE)) : ch;
  return out;
}

/**
 * Sizes a card from its content. Long lines soft-wrap at exactly `cols`
 * characters (the renderer breaks anywhere, and the font is monospace), so the
 * number of visual rows — and therefore the card height — is known up front.
 */
function measureFile(file: SourceFile): Box {
  const lines = file.content.split("\n");
  const shown: string[] = [];
  let longest = 0;
  for (const raw of lines.slice(0, MAX_LINES)) {
    const line = expandTabs(raw);
    shown.push(line);
    longest = Math.max(longest, lineColumns(line));
  }
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.ceil(longest)));

  let rows = 0;
  let kept = 0;
  for (; kept < shown.length && rows < MAX_ROWS; kept++) {
    const lineRows = wrappedRows(shown[kept], cols);
    if (rows + lineRows > MAX_ROWS) {
      // A huge line (e.g. minified code) is cut to fit the remaining budget.
      shown[kept] = shown[kept].slice(0, (MAX_ROWS - rows) * cols);
      rows = MAX_ROWS;
      kept++;
      break;
    }
    rows += lineRows;
  }
  const hiddenLines = lines.length - kept;

  const w = CARD_BORDER * 2 + GUTTER + cols * CHAR_W + CODE_PAD_RIGHT;
  const h = CARD_BORDER * 2 + CARD_HEADER + CODE_PAD_Y * 2 + (rows + (hiddenLines > 0 ? 1 : 0)) * LINE_H;
  return {
    kind: "file",
    w,
    h,
    file,
    text: shown.slice(0, kept).join("\n"),
    cols,
    lineCount: lines.length,
    hiddenLines,
  };
}

/**
 * Skyline bottom-left packing: tallest boxes first, each dropped at the lowest
 * spot of the skyline where it fits within a roughly screen-shaped target width.
 */
function pack(boxes: Box[], gap: number): { placed: Placed[]; w: number; h: number } {
  if (boxes.length === 0) return { placed: [], w: 0, h: 0 };
  const sorted = [...boxes].sort((a, b) => b.h - a.h || b.w - a.w);
  const area = sorted.reduce((s, b) => s + (b.w + gap) * (b.h + gap), 0);
  const widest = Math.max(...sorted.map((b) => b.w + gap));
  const target = Math.max(widest, Math.sqrt(area * ASPECT));

  let skyline: { x: number; w: number; y: number }[] = [{ x: 0, w: target, y: 0 }];
  const placed: Placed[] = [];
  let maxW = 0;
  let maxH = 0;

  for (const b of sorted) {
    const bw = b.w + gap;
    let best: { x: number; y: number } | null = null;
    for (let i = 0; i < skyline.length; i++) {
      const x = skyline[i].x;
      if (x + bw > target + 0.5) break;
      let y = 0;
      for (let j = i; j < skyline.length && skyline[j].x < x + bw; j++) y = Math.max(y, skyline[j].y);
      if (!best || y < best.y) best = { x, y };
    }
    const { x, y } = best ?? { x: 0, y: Math.max(...skyline.map((s) => s.y)) };
    placed.push({ ...b, x, y });
    maxW = Math.max(maxW, x + b.w);
    maxH = Math.max(maxH, y + b.h);

    // Raise the skyline under the new box, then merge equal-height neighbours.
    const next: typeof skyline = [];
    for (const s of skyline) {
      const end = s.x + s.w;
      if (end <= x || s.x >= x + bw) next.push(s);
      else {
        if (s.x < x) next.push({ x: s.x, w: x - s.x, y: s.y });
        if (end > x + bw) next.push({ x: x + bw, w: end - x - bw, y: s.y });
      }
    }
    next.push({ x, w: bw, y: y + b.h + gap });
    next.sort((a, c) => a.x - c.x);
    skyline = [];
    for (const s of next) {
      const last = skyline[skyline.length - 1];
      if (last && last.y === s.y) last.w += s.w;
      else skyline.push({ ...s });
    }
  }
  return { placed, w: maxW, h: maxH };
}

function layoutDir(dir: Dir): Box & { kind: "folder" } {
  const fileBoxes = dir.files.map(measureFile);
  const folderBoxes = [...dir.dirs.values()].map(layoutDir);

  // Files of this folder form one tight block, which is then packed together
  // with the sub-folder boxes.
  const blocks: Box[] = [...folderBoxes];
  if (fileBoxes.length) {
    const filesBlock = pack(fileBoxes, FILE_GAP);
    blocks.push({
      kind: "folder",
      w: filesBlock.w,
      h: filesBlock.h,
      header: 0,
      dir: null,
      fileCount: fileBoxes.length,
      children: filesBlock.placed,
    });
  }
  const content = pack(blocks, FOLDER_GAP);
  const fileCount = dir.files.length + folderBoxes.reduce((s, b) => s + b.fileCount, 0);

  return {
    kind: "folder",
    w: content.w + FOLDER_PAD * 2,
    h: content.h + FOLDER_PAD + FOLDER_HEADER,
    header: FOLDER_HEADER,
    dir,
    fileCount,
    children: content.placed.map((p) => ({ ...p, x: p.x + FOLDER_PAD, y: p.y + FOLDER_HEADER })),
  };
}

export function computeLayout(files: SourceFile[], rootName: string): Layout {
  const root = layoutDir(buildTree(files, rootName));
  const out: Layout = { files: [], folders: [], width: root.w, height: root.h };

  const walk = (node: Placed, ox: number, oy: number, depth: number) => {
    const x = ox + node.x;
    const y = oy + node.y;
    if (node.kind === "file") {
      out.files.push({
        path: node.file.path,
        name: node.file.path.slice(node.file.path.lastIndexOf("/") + 1),
        text: node.text,
        cols: node.cols,
        lineCount: node.lineCount,
        hiddenLines: node.hiddenLines,
        x, y, w: node.w, h: node.h, depth,
      });
      return;
    }
    if (node.dir) {
      out.folders.push({
        path: node.dir.path,
        name: node.dir.name,
        fileCount: node.fileCount,
        x, y, w: node.w, h: node.h, header: node.header, depth,
      });
    }
    const childDepth = node.dir ? depth + 1 : depth;
    for (const child of node.children) walk(child, x, y, childDepth);
  };
  walk({ ...root, x: 0, y: 0 }, 0, 0, 0);
  return out;
}
