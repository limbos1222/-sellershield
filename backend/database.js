const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'leadloop.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_description TEXT NOT NULL,
      icp TEXT NOT NULL,
      pain_points TEXT NOT NULL,
      subreddits TEXT NOT NULL,
      keywords TEXT NOT NULL,
      response_style TEXT NOT NULL DEFAULT 'helpful_expert',
      status TEXT NOT NULL DEFAULT 'active',
      warmup_mode INTEGER NOT NULL DEFAULT 0,
      warmup_days_remaining INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reddit_leads (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      reddit_post_id TEXT NOT NULL,
      subreddit TEXT NOT NULL,
      post_title TEXT NOT NULL,
      post_url TEXT NOT NULL,
      post_content TEXT,
      author TEXT,
      relevance_score INTEGER,
      analysis TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      found_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_responses (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      response_text TEXT NOT NULL,
      claude_reasoning TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      edited_text TEXT,
      posted_at TEXT,
      reddit_comment_id TEXT,
      rejection_reason TEXT,
      scheduled_for TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES reddit_leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      lead_id TEXT,
      event_type TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      leads_found INTEGER DEFAULT 0,
      responses_generated INTEGER DEFAULT 0,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );
  `);

  // Seed default settings
  const defaults = [
    ['anthropic_api_key', ''],
    ['reddit_client_id', ''],
    ['reddit_client_secret', ''],
    ['reddit_username', ''],
    ['reddit_password', ''],
    ['max_posts_per_day', '10'],
    ['auto_posting_enabled', 'false'],
    ['blacklist_users', '[]'],
    ['blacklist_subreddits', '[]'],
    ['signature', ''],
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  for (const [key, value] of defaults) {
    insert.run(key, value);
  }
}

module.exports = { getDb };
