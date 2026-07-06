# Launch strategy — Feedloft

## Target subreddits

- **r/rss** — the most on-topic audience possible; lead with the
  technical angle (SQLite FTS5, conditional GET, Readability
  extraction) rather than the sales pitch. Rules-aware: most RSS-focused
  subs allow self-promo if framed as "I built this" with genuine
  technical detail and an open invitation for criticism, not a bare
  link. Disclose it's a paid+free hybrid up front.
- **r/selfhosted** — this community is highly allergic to disguised
  ads; post as "I self-hosted my RSS reader instead of paying for
  Feedly — here's Feedloft (MIT, source included)". Emphasize the
  Docker Compose one-liner and that the *entire product* is free/open;
  the Whop listing is only a convenience installer, not gated
  functionality. Follow the sub's self-promo Saturday / flair rules if
  present.
- **r/opensource** — frame purely around the MIT license, architecture
  choices (external-content-free FTS5, conditional GET), and inviting
  contributions — no pricing mention needed here.
- **r/webdev** or **r/node** — technical build-in-public post about the
  encoding/malformed-XML/guid-dedupe edge cases; developers love a good
  "here's what actually breaks when you parse RSS at scale" post.
- **r/degoogle** — angle: no Google Reader-successor subscription tax,
  no data leaving your box.

## Hacker News "Show HN" draft

**Title:** Show HN: Feedloft – a self-hosted RSS reader, MIT licensed,
$24 once instead of $96/yr

**Body:**

I got tired of the RSS reader subscription treadmill (Feedly Pro is
$8/month for software that's architecturally a poller + a database), so
I built Feedloft: a self-hosted RSS reader with folders, OPML
import/export, full-text extraction via Readability for feeds that only
publish summaries, and SQLite FTS5 search that stays instant even at
tens of thousands of stored articles.

It's a single Node process (Express + better-sqlite3) serving a React
client, with a background poller that respects conditional GET
(ETag/Last-Modified, honors 304s) and backs off on failing feeds. Item
identity falls back to a stable hash of title+pubDate when a feed omits
guids, so items don't duplicate on every poll — a bug I hit constantly
testing against real-world feeds with malformed XML, inconsistent
encodings, and RFC822-vs-ISO8601 date chaos.

Source is MIT and on GitHub. There's also a packaged Windows
installer/Electron desktop build on Whop for people who'd rather not run
`npm install` — but the self-hosted version is the full product, not a
crippled trial.

Would appreciate feedback, especially on the feed-parsing edge cases —
I'm sure there are more malformed-XML horror stories to fix.

## 10 SEO keywords

1. self-hosted rss reader
2. feedly alternative
3. open source rss reader
4. rss reader without subscription
5. one-time payment rss reader
6. self-host feedly alternative
7. rss reader docker
8. rss reader electron desktop app
9. opml import export tool
10. full text rss extraction

## AppSumo / PitchGround pitch paragraph

Feedloft is a self-hosted RSS reader built for people (and teams) who
read a lot and don't want another monthly SaaS line item. It ships with
everything the $8/month readers charge for — folder organization,
unread tracking, OPML import/export, automatic full-text extraction for
feeds that only publish summaries, and instant full-text search — but
runs entirely on infrastructure the buyer already controls: a home
server, a $5 VPS, or as a native desktop app via the bundled Electron
wrapper. One lifetime-deal payment replaces an indefinite subscription,
the source is MIT-licensed so buyers can audit or extend it, and there's
zero telemetry or vendor lock-in. It's a natural fit for a one-time-price
marketplace: high perceived value (replaces a recurring SaaS cost),
low support burden (single SQLite file, Docker Compose deploy), and a
technical-enough audience (self-hosters, developers, power readers) to
appreciate what "you own this" actually means.

## Pricing math vs. Feedly Pro

- Feedly Pro: **$8/month = $96/year**, indefinitely.
- Feedloft: **$24 once.**
- Break-even: **3 months** (3 × $8 = $24). Every month after that is
  pure savings — by month 12 the buyer is $72 ahead; by month 24, $168
  ahead; and so on, compounding forever since there's no recurring fee.
- Even generously assuming a self-hoster's VPS costs $5/month and
  Feedloft is the only thing running on it, the lifetime cost still
  crosses over and stays below Feedly Pro within the first year, and the
  VPS is almost always already running other things anyway.
