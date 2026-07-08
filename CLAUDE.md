# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-user launch/landing page (gennetten.org) with a built-in editor. It's a React 19 + Vite + TypeScript SPA styled with Tailwind CSS v4. The site content — site title/tagline/footer plus a list of link cards — lives entirely in a JSON file (`cards.json`), not a database. The editor lets an admin reorder, add, edit, and delete cards, then either export the JSON for git or publish it directly to the live server via a small PHP endpoint.

## Commands

```bash
npm run dev        # Vite dev server (editor is unlocked in DEV — no password)
npm run build      # tsc -b (typecheck) then vite build → dist/
npm run preview    # serve the production build locally
npm run deploy     # build + SSH/SCP deploy (Windows, scripts/deploy.ps1)
npm run deploy:unix # same, bash (scripts/deploy.sh)
```

There is no test suite, linter, or test runner configured. `npm run build` is the only correctness gate — it runs `tsc -b` across the three `tsconfig.*.json` project references before bundling. Run it after any TypeScript change.

## Architecture

### Two routes, one data source
- `/` → `LaunchPage` — public read-only view. Loads live data only.
- `/admin` → `EditorPage`, wrapped in `AdminGuard` — the editor.

Both pages render from the same `SiteData` shape (`src/types/card.ts`) via `CardGrid` + `SiteHeader`/`SiteFooter`, and both get their data through the **`useSiteData`** hook (`src/hooks/useSiteData.ts`). The hook's `useDrafts` option is the key branch:
- `useDrafts: false` (public page) — always fetches live `/data/cards.json`.
- `useDrafts: true` (editor) — prefers a localStorage draft; edits auto-save to localStorage on every change (`dirty` flag). `reloadLive()` discards the draft and re-fetches.

### The data pipeline (how content actually flows)
`cards.json` exists in three places, and the distinction matters:
- `src/data/cards.json` — bundled fallback, imported at build time (`defaultSiteData`).
- `public/data/cards.json` — served at `/data/cards.json` in dev and copied into `dist/` on build. This is the "live" file the public page fetches.
- On the **server**, `data/cards.json` is the source of truth and is *preserved across deploys* — `deploy.ps1` detects an existing remote copy and skips overwriting it, so editor publishes are never clobbered by a redeploy.

Two ways content leaves the editor:
1. **Export** (`exportSiteData`) — downloads `cards.json` for manual commit to git.
2. **Publish** (`publishSiteData` → `POST /api/publish.php`) — writes `data/cards.json` on the live server atomically (temp file + `rename`). This is the "one-click publish" path.

### Auth model (client-side, intentionally lightweight)
`src/lib/adminAuth.ts` gates the editor. The password is embedded at **build time** from `VITE_ADMIN_PASSWORD` (Vite inlines `VITE_*`). In DEV the editor is unlocked with no password. The same password is sent to `publish.php`, which compares it server-side with `hash_equals` against `api/config.php`. This is not strong auth — it's a casual gate for a personal site. The nginx.conf includes commented-out HTTP Basic auth for the `/admin` route as optional hardening.

### URL safety
All card URLs are validated to be `http(s)` only, in **three** layers that must stay in sync: `src/lib/security.ts` (`sanitizeUrl`/`isSafeUrl`) on save/import/publish in the client, and a `preg_match` check in `publish.php`. When touching URL handling, update both.

### Icons
Cards reference Lucide icons by string name. `src/lib/icons.ts` maps those strings to imported components (`getIcon` falls back to `Link`). `POPULAR_ICONS` in `src/types/card.ts` is the editor's picker list. **Adding a new icon requires editing both files**: import + map entry in `icons.ts`, and the name in `POPULAR_ICONS`.

## Deployment

Target is **shared hosting with Apache/PHP** (SSH/SCP push), despite the nginx.conf reference file. `scripts/deploy.ps1` (the `npm run deploy` default):
1. Reads `deploy.config.json` (git-ignored; copy from `deploy.config.example.json`) and `.env`.
2. `npm ci` + `npm run build` with `VITE_ADMIN_PASSWORD` injected.
3. Generates `dist/api/config.php` (password + GitHub token/owner) — **never committed**, written fresh each deploy.
4. SCPs `dist/*` to the remote path, preserving the live `data/cards.json`, and fixes file permissions (shared hosting needs world-readable assets; `config.php` set to 600).

The PHP endpoints (`public/api/`) ship as static assets:
- `publish.php` — receives editor publishes, writes `data/cards.json`.
- `github-stats.php` — server-side proxy that aggregates weekly code-frequency across GitHub repos (keeps the token off the client). Powers `GithubActivityChart`. Uses the token from `config.php` (private repos) or falls back to a public `github_owner`.

**Dev note:** Vite serves `.php` files as static source (it can't execute PHP), so in dev the chart's `fetch('/api/github-stats.php')` would get raw `<?php …` and fail. `vite.config.ts` contains a `dev-github-stats` middleware plugin that reimplements the endpoint in Node for dev only, reading `githubToken`/`githubOwner` from `deploy.config.json` (or `GITHUB_TOKEN`/`GITHUB_OWNER` env), mirroring the deploy scripts. It re-reads the config on each request, so editing `deploy.config.json` takes effect on page reload without a server restart. **Real (non-zero) data needs a token in both dev and prod** — unauthenticated GitHub API is capped at 60 req/hr and one page load needs ~1 + N-repos calls.

## Config files & secrets (all git-ignored)
- `.env` — `VITE_ADMIN_PASSWORD` (build-time). Copy from `.env.example`.
- `deploy.config.json` — SSH target + GitHub owner/token. Copy from `deploy.config.example.json`.
- `public/api/config.php` — generated by deploy; holds the server-side password and GitHub token.
