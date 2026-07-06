'use strict';

const { refreshFeed } = require('./lib/feedService');

const MAX_CONCURRENT = 4;
const TICK_MS = 30 * 1000; // check for due feeds every 30s

class Poller {
  constructor(db, { defaultPollMinutes = 15 } = {}) {
    this.db = db;
    this.defaultPollMinutes = defaultPollMinutes;
    this.timer = null;
    this.running = false;
    this.stats = { lastTickAt: null, lastRunFeedIds: [], totalPolls: 0, totalErrors: 0 };
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => {}), TICK_MS);
    // Kick an initial tick shortly after boot (staggered, not immediate).
    setTimeout(() => this.tick().catch(() => {}), 3000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return; // avoid overlapping ticks
    this.running = true;
    try {
      const due = this.getDueFeeds();
      this.stats.lastTickAt = new Date().toISOString();
      if (!due.length) return;

      // Process with bounded concurrency.
      let idx = 0;
      const worker = async () => {
        while (idx < due.length) {
          const feed = due[idx++];
          this.stats.totalPolls++;
          const result = await refreshFeed(this.db, feed.id);
          if (result && result.error) this.stats.totalErrors++;
        }
      };
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, due.length) }, worker);
      await Promise.all(workers);
      this.stats.lastRunFeedIds = due.map((f) => f.id);
    } finally {
      this.running = false;
    }
  }

  getDueFeeds() {
    const feeds = this.db.prepare('SELECT * FROM feeds').all();
    const now = Date.now();
    return feeds.filter((f) => {
      const minutes = f.poll_minutes || this.defaultPollMinutes;
      // back off exponentially (capped) after repeated errors
      const backoffMultiplier = Math.min(2 ** Math.max(0, f.error_count - 1), 16);
      const effectiveMinutes = minutes * (f.error_count > 0 ? backoffMultiplier : 1);
      if (!f.last_polled_at) return true;
      const last = new Date(f.last_polled_at).getTime();
      return now - last >= effectiveMinutes * 60 * 1000;
    });
  }
}

module.exports = { Poller };
