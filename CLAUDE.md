# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a personal workspace containing three independent projects at the top level. There is no shared tooling — each project is self-contained.

- [poker-dashboard/](poker-dashboard/) — React + Vite app for analysing PokerNow CSV hand histories. The only project with a build system.
- [photo-editor/](photo-editor/) — Single-file `index.html` photo editor. Open directly in a browser; no build step.
- [flappybird/](flappybird/) — Single-file `index.html` Flappy Bird clone. Open directly in a browser; no build step.

When the user references a project by name, work inside that subdirectory. Don't introduce shared infrastructure (root `package.json`, monorepo tooling, etc.) — these projects are intentionally independent.

---

## poker-dashboard

React 19 + Vite SPA. State lives in `localStorage`; there is no backend.

### Commands (run from `poker-dashboard/`)

```
npm install          # one-time install
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # production build to dist/
npm run lint         # ESLint over all .js/.jsx
npm run preview      # preview the built bundle
```

There is no test runner configured. `start-dev.bat` is a Windows convenience script that wipes `node_modules` and `package-lock.json` before reinstalling — only use it when the install is genuinely broken.

### Architecture

Data flows in one direction: **CSV text → `parser.js` → `stats.js` → `sessions.js` (localStorage) → React components**.

- [src/App.jsx](poker-dashboard/src/App.jsx) — root component. Owns `view` state which is `null` (home) | `{type:'single', id}` | `{type:'merged', selectedIds[]}` | `{type:'trends'}`. On first launch (empty localStorage) it auto-ingests `/log1.csv` and `/log2.csv` from `public/`.
- [src/parser.js](poker-dashboard/src/parser.js) — PapaParse-based CSV reader. Exports `hashContent` (FNV-1a, used for duplicate-upload detection), `parseLog`, `normaliseCard` (handles Unicode + mojibake suit symbols), `classifyHand`, `extractGameDate`, `formatSessionName`.
- [src/stats.js](poker-dashboard/src/stats.js) — the analysis engine. `analyseLog(rows)` runs a hand-level state machine over sorted rows, committing each hand to per-player accumulators when a hand-end marker is hit. Computes VPIP, PFR, AF, win rate, net chips, luckiness, plus bad-beat / suck-out detection (Two Pair or better losing at showdown). Viewer's hole cards are detected by name starting with `"will"`.
- [src/sessions.js](poker-dashboard/src/sessions.js) — localStorage CRUD under key `"poker-sessions"`. `mergeSessions` aggregates accumulators from multiple sessions and recomputes derived percentages; it also tags `handsHistory`/`badBeats`/`suckOuts` entries with `sessionId` + `sessionDate` so the merged hand table can show provenance.
- [src/handEval.js](poker-dashboard/src/handEval.js) — 5-card evaluator. `bestHand(holeCards, board)` enumerates C(n,5) and returns the best `{rank, name}`. Rank 9 = Royal Flush; the wheel A-2-3-4-5 is detected separately and stays a Straight Flush.
- [src/index.css](poker-dashboard/src/index.css) — single-file stylesheet, dark theme via CSS custom properties on `:root` (`--bg`, `--accent`, `--green`, `--red`, etc.).

### Components

- [Dashboard.jsx](poker-dashboard/src/components/Dashboard.jsx) — main view after a session loads. Renders header, stats grid, `<OverviewCharts>`, player tabs, `<PlayerDetail>`, `<Leaderboard>`.
- [SessionsHome.jsx](poker-dashboard/src/components/SessionsHome.jsx) — landing page with drop zone + session list.
- [PlayerDetail.jsx](poker-dashboard/src/components/PlayerDetail.jsx) — searchable/sortable hand-history table with expandable rows, plus bad-beat / suck-out sections. Search supports compact card notation (`AA`, `AKs`, `1010`), spelled-out names (`"ace of spades"`), and space-separated rank/suit.
- [Leaderboard.jsx](poker-dashboard/src/components/Leaderboard.jsx) — summary table sorted by net chips with tight/loose + aggressive/passive style tags.
- [OverviewCharts.jsx](poker-dashboard/src/components/OverviewCharts.jsx) — four Recharts bar charts (only includes players with ≥ 3 hands).
- [TrendsView.jsx](poker-dashboard/src/components/TrendsView.jsx) — cross-session trend view (separate top-level route).

### Data model

Each saved session in localStorage:

```json
{
  "id": "m0abc123xyz",
  "fileName": "poker-04-12-2025",
  "gameDate": "2025-04-12",
  "uploadedAt": "...",
  "handCount": 87,
  "playerNames": ["..."],
  "contentHash": "a1b2c3d4",
  "stats": { "players": { "...": {} }, "handCount": 87 }
}
```

Player entries inside `stats.players` carry both raw accumulators (`vpipHands`, `pfrHands`, `totalBetsRaises`, `totalCalls`, `handsDealt`, `buyIns`, `cashOut`, …) and derived percentages (`vpip`, `pfr`, `af`, `winRate`, `netChips`, `luckiness`, `tightness`). When merging sessions, only accumulators are summed — derived metrics are recomputed from the totals.

### Things to know when editing

- The README at [poker-dashboard/README.md](poker-dashboard/README.md) is written for non-developer end-users (it walks through installing Node from scratch). Keep that section in plain language; the developer-facing "Codebase overview" is at the bottom of the same file.
- Sample CSVs are checked in at the repo root and copied/referenced from `poker-dashboard/public/`. Auto-load only fires when localStorage is empty.
- `af` is capped at `99` when a player has 0 post-flop calls. The aggression-factor chart caps display at 10.
- Duplicate uploads are rejected via `hashContent` comparison against existing sessions — don't bypass this in upload handlers.
