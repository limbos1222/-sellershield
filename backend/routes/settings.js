const express = require('express');
const { getDb } = require('../database');
const { testAuth, isConfigured } = require('../reddit');

const router = express.Router();

// Sensitive keys — masked in GET response
const SENSITIVE_KEYS = ['anthropic_api_key', 'reddit_client_secret', 'reddit_password'];

// Get all settings
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all();

  const settings = {};
  for (const row of rows) {
    if (SENSITIVE_KEYS.includes(row.key)) {
      settings[row.key] = row.value ? '••••••••' : '';
      settings[`${row.key}_set`] = !!row.value;
    } else {
      settings[row.key] = tryParse(row.value);
    }
    settings[`${row.key}_updated_at`] = row.updated_at;
  }

  settings.demo_mode = !isConfigured();
  settings.reddit_configured = isConfigured();

  res.json(settings);
});

// Update settings
router.put('/', (req, res) => {
  const db = getDb();
  const allowed = [
    'anthropic_api_key',
    'reddit_client_id', 'reddit_client_secret', 'reddit_username', 'reddit_password',
    'max_posts_per_day', 'auto_posting_enabled',
    'blacklist_users', 'blacklist_subreddits',
    'signature',
  ];

  const update = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const updates = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      let val = req.body[key];
      if (typeof val === 'object') val = JSON.stringify(val);
      if (typeof val === 'boolean') val = String(val);

      // Don't overwrite if placeholder sent
      if (SENSITIVE_KEYS.includes(key) && val === '••••••••') continue;

      update.run(key, val);
      updates.push(key);
    }
  }

  res.json({ success: true, updated: updates });
});

// Test Reddit auth
router.post('/test-reddit', async (req, res) => {
  try {
    const result = await testAuth();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function tryParse(val) {
  try { return JSON.parse(val); } catch { return val; }
}

module.exports = router;
