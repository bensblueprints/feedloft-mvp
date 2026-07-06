# Product Hunt launch kit — Feedloft

## Name
Feedloft

## Tagline (60 char max)
Self-hosted RSS reader. Pay once, own it forever. (56 chars)

## Short description (260 char max)
Feedloft is a fast, keyboard-first RSS reader you host yourself — folders,
OPML import/export, full-text extraction, and instant search. $24 once vs
Feedly Pro's $96/year. Your feeds, your server, your data. (256 chars)

## Full description

RSS readers used to be something you owned. Then they became something
you rent — $8/month here, $12/month there, forever, for software that's
mostly just a database and a poller.

Feedloft flips that back. It's a real RSS reader — folders, unread
counts, OPML import/export, full-text extraction for feeds that only
publish summaries, instant full-text search — that you self-host on a
$5 VPS, a Raspberry Pi, or your own machine as a desktop app. One Node
process, one SQLite file. No accounts, no telemetry, no "we've updated
our pricing" emails.

It's built to be used entirely from the keyboard: `j`/`k` to move
through articles, `o` to open, `s` to star, `/` to search, `?` for the
full cheat sheet. Dense, dark-mode-first, 3-pane layout — folders on the
left, article list in the middle, reading pane on the right.

Under the hood: Express + better-sqlite3 + rss-parser (handles RSS 2.0,
RSS 1.0/RDF, and Atom), conditional GET so your polling doesn't hammer
publishers, Mozilla's own Readability library for full-text extraction,
and SQLite FTS5 for search that returns instantly even with tens of
thousands of stored articles.

The code is MIT-licensed and lives on GitHub — audit it, fork it, run it
on your own infra forever. If you'd rather skip `npm install` and get a
packaged installer, that's available too, once, for $24.

## Maker's first comment

I got tired of paying $8/month to read RSS feeds — feeds that are, by
definition, free and open. Feedly's fine! But it's $96 a year for
something that's architecturally a poller and a database, and I already
have a VPS sitting there doing nothing most of the day.

So I built Feedloft: same core feature set (folders, full-text search,
OPML, full-text extraction for truncated feeds) but self-hosted, MIT
licensed, and yours forever once you run it. It's a single Docker
compose file or a plain `npm start` away from running on whatever you've
already got. There's also a packaged desktop app for people who just
want to double-click something.

Would love feedback from fellow RSS die-hards — especially on the
keyboard shortcuts (I tried to make it feel like a proper terminal
reader, not a web app pretending to have shortcuts).

## Gallery shot list (5 shots)

1. **Hero — 3-pane reader in dark mode.** Sidebar with folders + unread
   counts, article list with a mix of read/unread rows, article pane
   open on a long-form piece with a "Fetch full text" pill visible.
2. **Keyboard shortcut overlay (`?`).** Full cheat sheet modal over a
   dimmed reader, showing the vim-style bindings (j/k/o/m/s/v/r/gg/G/​).
3. **OPML import in progress.** Settings popover open with "Import
   OPML" highlighted, a file picker dialog, and a toast/summary showing
   "2 folders, 3 feeds imported."
4. **Search results view.** Search bar with a query typed in, results
   list showing matched articles across multiple feeds with snippet
   highlighting.
5. **Feed settings modal + error state.** Modal open on a feed with a
   visible error count / last-error message, poll-interval override
   field, and the "always fetch full text" toggle switched on.
