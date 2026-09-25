"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, PlacedFile } from "@/lib/layout";
import { FileCard } from "./FileCard";

type Camera = { x: number; y: number; scale: number };

const MIN_SCALE = 0.002; // big repos (1500 files) span ~100k px
const MAX_SCALE = 4;
const DETAIL_SCALE = 0.3; // below this, cards render as lightweight placeholders
const CULL_MARGIN = 400; // screen px rendered beyond the viewport edges
const ANIMATION_MS = 420;
const SETTLE_MS = 150; // idle time before text is re-rasterized crisply

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Same nesting level = same colour.
const FOLDER_HUES = [262, 199, 158, 32, 330, 48, 280, 12];
const hueFor = (depth: number) => FOLDER_HUES[depth % FOLDER_HUES.length];
const FOLDER_LABEL_INSET = 16; // world px from the folder's left edge

export function InfiniteCanvas({ layout }: { layout: Layout }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Camera tweens run in JS (not CSS transitions) so culling, level of detail
  // and label sizes stay in sync with the transform on every frame.
  const animRef = useRef<{ frame: number; fallback: ReturnType<typeof setTimeout> } | null>(null);
  const stopAnimation = useCallback(() => {
    if (!animRef.current) return;
    cancelAnimationFrame(animRef.current.frame);
    clearTimeout(animRef.current.fallback);
    animRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: Camera) => {
      stopAnimation();
      const el = containerRef.current;
      if (!el) return;
      const from = cameraRef.current;
      const hw = el.clientWidth / 2;
      const hh = el.clientHeight / 2;
      // Interpolate the world point under the screen centre linearly and the
      // scale logarithmically, which makes zooming feel uniform.
      const c0 = { x: (hw - from.x) / from.scale, y: (hh - from.y) / from.scale };
      const c1 = { x: (hw - target.x) / target.scale, y: (hh - target.y) / target.scale };
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ANIMATION_MS);
        const e = 1 - Math.pow(1 - t, 3);
        const scale = from.scale * Math.pow(target.scale / from.scale, e);
        const cx = c0.x + (c1.x - c0.x) * e;
        const cy = c0.y + (c1.y - c0.y) * e;
        setCamera({ scale, x: hw - cx * scale, y: hh - cy * scale });
        if (t < 1 && animRef.current) animRef.current.frame = requestAnimationFrame(tick);
        else stopAnimation();
      };
      animRef.current = {
        frame: requestAnimationFrame(tick),
        // Background or occluded tabs may never deliver animation frames;
        // make sure the camera still ends up where it was sent.
        fallback: setTimeout(() => {
          stopAnimation();
          setCamera(target);
        }, ANIMATION_MS + 200),
      };
    },
    [stopAnimation]
  );

  const fitRect = useCallback(
    (x: number, y: number, w: number, h: number, padding = 80, maxScale = 1.2) => {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scale = clamp(Math.min((cw - padding * 2) / w, (ch - padding * 2) / h), MIN_SCALE, maxScale);
      animateTo({ scale, x: cw / 2 - (x + w / 2) * scale, y: ch / 2 - (y + h / 2) * scale });
    },
    [animateTo]
  );

  const fitAll = useCallback(
    () => fitRect(0, 0, layout.width, layout.height),
    [fitRect, layout.width, layout.height]
  );

  // Zoom to a readable scale, with the top of the file just below the top bar.
  const focusFile = useCallback(
    (f: PlacedFile) => {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scale = clamp(Math.min((cw - 80) / f.w, (ch - 120) / f.h), 0.75, 1.25);
      animateTo({
        scale,
        x: cw / 2 - (f.x + f.w / 2) * scale,
        y: f.h * scale < ch - 120 ? ch / 2 - (f.y + f.h / 2) * scale : 84 - f.y * scale,
      });
    },
    [animateTo]
  );

  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number, animate = false) => {
      const zoomed = (c: Camera) => {
        const scale = clamp(c.scale * factor, MIN_SCALE, MAX_SCALE);
        const k = scale / c.scale;
        return { scale, x: sx - (sx - c.x) * k, y: sy - (sy - c.y) * k };
      };
      if (animate) return animateTo(zoomed(cameraRef.current));
      stopAnimation();
      setCamera(zoomed);
    },
    [animateTo, stopAnimation]
  );

  // Track viewport size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fitAll();
  }, [fitAll]);

  // Wheel: zoom around the cursor. Trackpad pinch arrives as ctrl+wheel.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.shiftKey) {
        stopAnimation();
        setCamera((c) => ({ ...c, x: c.x - (e.deltaY || e.deltaX), y: c.y }));
        return;
      }
      const intensity = e.ctrlKey ? 0.01 : 0.0015;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-delta * intensity), sx, sy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, stopAnimation]);

  // Pointer input: one pointer pans, two pointers (touch) pinch-zoom and pan
  // together around the point between the fingers.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: number; x: number; y: number; started: boolean } | null>(null);
  const pinch = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      midX: (a.x + b.x) / 2 - rect.left,
      midY: (a.y + b.y) / 2 - rect.top,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Second finger down: switch from panning to pinching.
      for (const id of pointers.current.keys()) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(id);
        } catch {}
      }
      drag.current = null;
      pinch.current = pinchState();
      setDragging(true);
      stopAnimation();
    } else if (pointers.current.size === 1) {
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, started: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const next = pinchState();
      const factor = next.dist / p.dist;
      setCamera((c) => {
        const scale = clamp(c.scale * factor, MIN_SCALE, MAX_SCALE);
        const k = scale / c.scale;
        // Zoom around the previous midpoint, then follow the midpoint's movement.
        return { scale, x: next.midX - (p.midX - c.x) * k, y: next.midY - (p.midY - c.y) * k };
      });
      pinch.current = next;
      return;
    }

    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.started) {
      // Capture only once the pointer really moves, so clicks/double-clicks reach cards.
      if (Math.hypot(dx, dy) < 3) return;
      d.started = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      stopAnimation();
    }
    d.x = e.clientX;
    d.y = e.clientY;
    setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    pinch.current = null;
    const rest = [...pointers.current.entries()];
    if (rest.length === 1) {
      // One finger lifted mid-pinch: keep panning with the other, without a jump.
      const [id, pos] = rest[0];
      drag.current = { id, x: pos.x, y: pos.y, started: true };
    } else if (rest.length === 0) {
      drag.current = null;
      setDragging(false);
    } else {
      pinch.current = pinchState();
    }
  };

  // iOS Safari emits its own gesture events on pinch and would zoom the whole
  // page; the canvas handles pinch itself via pointer events.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"];
    for (const name of events) el.addEventListener(name, block, { passive: false });
    return () => {
      for (const name of events) el.removeEventListener(name, block);
    };
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const el = containerRef.current;
      if (!el) return;
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      if (e.key === "0" || e.key === "f") fitAll();
      else if (e.key === "=" || e.key === "+") zoomAt(1.4, cx, cy, true);
      else if (e.key === "-") zoomAt(1 / 1.4, cx, cy, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitAll, zoomAt]);

  // Only render cards that intersect the (padded) viewport.
  const view = useMemo(() => {
    const m = CULL_MARGIN / camera.scale;
    return {
      x0: -camera.x / camera.scale - m,
      y0: -camera.y / camera.scale - m,
      x1: (size.w - camera.x) / camera.scale + m,
      y1: (size.h - camera.y) / camera.scale + m,
    };
  }, [camera, size]);

  const visibleFiles = useMemo(
    () => layout.files.filter((f) => f.x < view.x1 && f.x + f.w > view.x0 && f.y < view.y1 && f.y + f.h > view.y0),
    [layout.files, view]
  );
  const visibleFolders = useMemo(
    () =>
      layout.folders.filter(
        (f) =>
          f.x < view.x1 && f.x + f.w > view.x0 && f.y < view.y1 && f.y + f.h > view.y0 &&
          f.w * camera.scale > 24 // skip folders too small to see
      ),
    [layout.folders, view, camera.scale]
  );

  // Folder labels live in screen space so they stay readable at any zoom.
  // Parents are placed first; a label that would collide with an already
  // placed one is dropped, so zooming out naturally shows only outer folders.
  const labels = useMemo(() => {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const out = [];
    const sorted = [...visibleFolders].sort((a, b) => a.depth - b.depth);
    for (const f of sorted) {
      const fw = f.w * camera.scale;
      if (fw < 70) continue;
      const fontSize = clamp(f.header * camera.scale * 0.42, 11, 15);
      const h = fontSize * 1.5;
      const x = f.x * camera.scale + camera.x + Math.max(8, FOLDER_LABEL_INSET * camera.scale);
      const y = f.y * camera.scale + camera.y + Math.max(4, (f.header * camera.scale - h) / 2);
      const text = f.depth > 0 ? `${f.name}/` : f.name;
      const maxW = fw - 16;
      const w = Math.min(maxW, (text.length + String(f.fileCount).length + 3) * fontSize * 0.62);
      const hit = placed.some((p) => x < p.x + p.w + 6 && x + w + 6 > p.x && y < p.y + p.h && y + h > p.y);
      if (hit) continue;
      placed.push({ x, y, w, h });
      out.push({ key: f.path || "/", x, y, maxW, fontSize, text, count: f.fileCount, hue: hueFor(f.depth) });
    }
    return out;
  }, [visibleFolders, camera]);

  // While the camera moves, promote the world to a GPU layer so panning and
  // zooming are cheap. Once it settles, drop the hint so the browser
  // re-rasterizes text at the current scale and it stays crisp.
  const worldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    el.classList.add("world--moving");
    const t = setTimeout(() => el.classList.remove("world--moving"), SETTLE_MS);
    return () => clearTimeout(t);
  }, [camera]);

  const detailed = camera.scale >= DETAIL_SCALE;

  // Background dot grid that follows the camera.
  let grid = 28 * camera.scale;
  while (grid < 14) grid *= 4;

  return (
    <div
      ref={containerRef}
      className={`canvas ${dragging ? "canvas--dragging" : ""}`}
      style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        const rect = containerRef.current!.getBoundingClientRect();
        zoomAt(2, e.clientX - rect.left, e.clientY - rect.top, true);
      }}
    >
      <div
        ref={worldRef}
        className={`world ${camera.scale < 0.08 ? "world--tiny" : ""}`}
        style={
          {
            transform: `translate(${Math.round(camera.x)}px, ${Math.round(camera.y)}px) scale(${camera.scale})`,
            "--inv": 1 / camera.scale,
          } as React.CSSProperties
        }
      >
        {visibleFolders.map((f) => (
          <div
            key={f.path || "/"}
            className="folder"
            style={{ left: f.x, top: f.y, width: f.w, height: f.h, "--hue": hueFor(f.depth) } as React.CSSProperties}
          />
        ))}
        {visibleFiles.map((f) => (
          <FileCard key={f.path} file={f} detailed={detailed} onFocus={focusFile} />
        ))}
      </div>

      <div className="labels">
        {labels.map((l) => (
          <div
            key={l.key}
            className="folder-label"
            style={
              { left: l.x, top: l.y, maxWidth: l.maxW, fontSize: l.fontSize, "--hue": l.hue } as React.CSSProperties
            }
          >
            <span className="folder-label__icon">▸</span>
            {l.text}
            <span className="folder-label__count">{l.count}</span>
          </div>
        ))}
      </div>

      <div className="zoom-controls" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2, true)} aria-label="Zoom out">−</button>
        <span className="zoom-controls__value">{camera.scale < 0.01 ? (camera.scale * 100).toFixed(1) : Math.round(camera.scale * 100)}%</span>
        <button onClick={() => zoomAt(1.4, size.w / 2, size.h / 2, true)} aria-label="Zoom in">+</button>
        <button className="zoom-controls__fit" onClick={fitAll}>Fit</button>
      </div>
      <div className="hint">Drag to pan · Scroll to zoom · Double-click a file to focus · <kbd>F</kbd> fit</div>
    </div>
  );
}
