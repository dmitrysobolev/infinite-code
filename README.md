# Infinite Code

Explore any public GitHub repository on an infinite canvas. Every text file is
rendered as a code card, and files are packed into nested folder boxes that
mirror the repository structure.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and enter `owner/repo` or a GitHub URL
(`/tree/<branch>` links are supported too).

Optionally copy `.env.example` to `.env.local` and set `GITHUB_TOKEN` to raise
the GitHub API rate limit from 60 to 5000 requests/hour.

## Controls

- Drag to pan, scroll (or pinch) to zoom around the cursor, <kbd>Shift</kbd>+scroll to pan horizontally
- Double-click a file to focus it, double-click empty space to zoom in
- <kbd>F</kbd> / <kbd>0</kbd> fit everything, <kbd>+</kbd> / <kbd>-</kbd> zoom

## How it works

- `app/api/repo` fetches the recursive git tree (2 GitHub API calls per repo) and filters text files (`lib/textFiles.ts`).
- The browser downloads file contents from `raw.githubusercontent.com` in parallel.
- `lib/layout.ts` measures each file and skyline-packs files and sub-folders into folder boxes, recursively.
- `components/InfiniteCanvas.tsx` renders only the cards in view, and switches to lightweight placeholders when zoomed out.
