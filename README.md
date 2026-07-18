# Feedloft

## Demo

VIDEO-PLACEHOLDER

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A fast, keyboard-first RSS reader you host yourself.**

Pay once. Own it forever. No subscription.

Feedloft is a self-hosted alternative to Feedly Pro — folders, OPML
import/export, full-text extraction, and instant full-text search, all
running on hardware you control. One Node process, one SQLite file, zero
telemetry.

![Feedloft screenshot placeholder](docs/screenshot.png)

## Features

- **Feed management** — add by URL with automatic feed discovery from any
  webpage (`<link rel="alternate">`), rename, move to folders, unsubscribe.
- **OPML import/export** — import preserves your folder structure, export
  produces valid OPML 2.0 you can take anywhere.
- **Smart polling** — background scheduler with conditional GET (ETag /
  Last-Modified, honors `304 Not Modified`), per-feed interval overrides,
  and automatic backoff for failing feeds.
- **Folders + virtual views** — one level of folders, unread counts
  everywhere, plus "All" and "Starred" views.
- **3-pane reading UI** — folders/feeds, article list, article view. Dense,
  dark-mode-first typography.
- **Keyboard-first** — `j`/`k` to move, `o`/`Enter` to open, `m` to
  toggle read, `s` to star, `v` to open the original in your browser, `r`
  to refresh, `gg`/`G` to jump, `/` to search, `?` for the full cheat
  sheet, `Shift+A` to mark all read.
- **Full-text extraction** — pull the full article via
  [Readability](https://github.com/mozilla/readability) when a feed only
  publishes summaries, either per-article or always-on per-feed.
- **Full-text search** — SQLite FTS5 across title + content, scoped to all
  feeds or just the one you're reading.
- **Desktop app** — the same server, wrapped in Electron, auto-logged-in,
  no browser required.
- **100% local** — no accounts, no analytics, no calls out except to fetch
  the feeds and pages you actually subscribed to.

## Tech stack

- **Server:** Node.js + Express + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Feed parsing:** [rss-parser](https://github.com/rbren/rss-parser) (RSS 2.0, RSS 1.0/RDF, Atom) + iconv-lite for encodings
- **Full-text extraction:** [@mozilla/readability](https://github.com/mozilla/readability) + jsdom + sanitize-html
- **Client:** React (Vite) + Tailwind CSS + [Lucide icons](https://lucide.dev) + [Motion](https://motion.dev)
- **Desktop:** Electron (thin wrapper around the same Express server)
- **Storage:** a single SQLite file, with FTS5 for search

## Quick start

```bash
npm install
cp .env.example .env      # set ADMIN_PASSWORD before exposing this to a network
npm run build              # builds the React client
npm start                   # builds + boots the server on http://localhost:5331
```

Or, for local development with hot reload on the client:

```bash
npm run server              # terminal 1: API on :5331
npm run dev:client          # terminal 2: Vite dev server with API proxy
```

### Desktop app

```bash
npm run desktop
```

Boots the same Express server on a free local port with its data stored
under Electron's per-user app-data directory, and opens a window
auto-logged-in as the admin user. `npm run dist` wires up an NSIS
installer via `electron-builder` (Windows), configured in `package.json`.

### Docker

```bash
docker compose up -d
```

The SQLite database is persisted in the `feedloft-data` volume. Configure
`ADMIN_PASSWORD` and `POLL_MINUTES` via a `.env` file or environment
variables before starting.

## Configuration

| Variable         | Default              | Description                                  |
|-------------------|-----------------------|-----------------------------------------------|
| `PORT`            | `5331`                | Port the Express server listens on            |
| `ADMIN_PASSWORD`  | `changeme`            | Password for the single admin login           |
| `POLL_MINUTES`    | `15`                  | Default background poll interval (minutes)    |

## Feedloft vs. Feedly Pro

| | **Feedloft** | Feedly Pro |
|---|---|---|
| Price | **$24 once** | $8/mo ($96/yr) |
| Hosting | Self-hosted, your data | Their cloud |
| Telemetry | None | Vendor analytics |
| Full-text search | ✅ (FTS5) | ✅ |
| OPML import/export | ✅ | ✅ |
| Full-text extraction | ✅ (Readability) | ✅ |
| Keyboard shortcuts | ✅ full vim-style set | Partial |
| Desktop app | ✅ (Electron) | Web only |
| Source | MIT, open | Closed |
| Break-even vs. Feedly Pro | **3 months** | — |

## ☕ Skip the setup — get the 1-click installer

Prefer not to run `npm install` yourself? Grab the packaged Windows
installer (desktop app, pre-built, auto-updating data folder) on Whop:

**[https://whop.com/onetime-suite](https://whop.com/onetime-suite)**

The source in this repository is fully functional and MIT-licensed — the
Whop listing is purely a convenience purchase for people who'd rather not
build it themselves.

## Testing

```bash
npm test
```

Runs `test/smoke.js`: an in-process fixture HTTP server serving RSS,
Atom, and truncated/full-article fixtures, driving a real ephemeral-port
instance of Feedloft against a temp SQLite database — no mocks, no
stubs. Covers login, feed add + parse, conditional GET / 304 handling,
guid dedupe on refresh, full-text extraction, read/star mutations, FTS5
search, and OPML import/export round-tripping.

## License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Ben (bensblueprints).
