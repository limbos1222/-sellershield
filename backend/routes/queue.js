const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { postComment, isConfigured } = require('../reddit');

const router = express.Router();

// Get review queue
router.get('/', (req, res) => {
  const db = getDb();
  const { campaign_id } = req.query;

  let query = `
    SELECT gr.*,
      rl.post_title, rl.post_url, rl.post_content, rl.subreddit,
      rl.author, rl.relevance_score, rl.analysis, rl.campaign_id,
      c.name as campaign_name, c.product_name
    FROM generated_responses gr
    JOIN reddit_leads rl ON rl.id = gr.lead_id
    JOIN campaigns c ON c.id = rl.campaign_id
    WHERE gr.status = 'pending'
  `;
  const params = [];

  if (campaign_id) {
    query += ' AND rl.campaign_id = ?';
    params.push(campaign_id);
  }

  query += ' ORDER BY gr.created_at DESC';

  const items = db.prepare(query).all(...params);
  res.json(items.map(parseQueueItem));
});

// Approve and post
router.post('/:id/approve', async (req, res) => {
  const db = getDb();
  const item = db.prepare(`
    SELECT gr.*, rl.post_url, rl.campaign_id, rl.id as lead_id
    FROM generated_responses gr
    JOIN reddit_leads rl ON rl.id = gr.lead_id
    WHERE gr.id = ?
  `).get(req.params.id);

  if (!item) return res.status(404).json({ error: 'Queue item not found' });
  if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

  const finalText = item.edited_text || item.response_text;

  // Check auto-posting setting
  const autoPostRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_posting_enabled');
  const canPost = autoPostRow?.value === 'true' || isConfigured();

  let commentId = null;
  let postedUrl = null;

  if (canPost && isConfigured()) {
    try {
      const result = await postComment({ postUrl: item.post_url, text: finalText });
      commentId = result.commentId;
      postedUrl = result.url;
    } catch (err) {
      return res.status(500).json({ error: `Failed to post to Reddit: ${err.message}` });
    }
  }

  db.prepare(`
    UPDATE generated_responses
    SET status = 'approved', posted_at = datetime('now'), reddit_comment_id = ?
    WHERE id = ?
  `).run(commentId, req.params.id);

  db.prepare(`
    UPDATE reddit_leads SET status = 'posted' WHERE id = ?
  `).run(item.lead_id);

  // Log event
  db.prepare(`
    INSERT INTO events (id, campaign_id, lead_id, event_type, metadata, created_at)
    VALUES (?, ?, ?, 'response_approved', ?, datetime('now'))
  `).run(uuidv4(), item.campaign_id, item.lead_id, JSON.stringify({ commentId, postedUrl, demoMode: !isConfigured() }));

  res.json({
    success: true,
    posted: isConfigured(),
    comment_id: commentId,
    posted_url: postedUrl,
    demo_mode: !isConfigured(),
  });
});

// Save edited version
router.post('/:id/edit', (req, res) => {
  const db = getDb();
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const item = db.prepare('SELECT * FROM generated_responses WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  db.prepare('UPDATE generated_responses SET edited_text = ? WHERE id = ?').run(text, req.params.id);
  res.json({ success: true });
});

// Reject
router.post('/:id/reject', (req, res) => {
  const db = getDb();
  const { reason } = req.body;

  const item = db.prepare(`
    SELECT gr.*, rl.id as lead_id, rl.campaign_id
    FROM generated_responses gr
    JOIN reddit_leads rl ON rl.id = gr.lead_id
    WHERE gr.id = ?
  `).get(req.params.id);

  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  db.prepare(`
    UPDATE generated_responses SET status = 'rejected', rejection_reason = ? WHERE id = ?
  `).run(reason || '', req.params.id);

  db.prepare(`
    UPDATE reddit_leads SET status = 'rejected' WHERE id = ?
  `).run(item.lead_id);

  // Log event
  db.prepare(`
    INSERT INTO events (id, campaign_id, lead_id, event_type, metadata, created_at)
    VALUES (?, ?, ?, 'response_rejected', ?, datetime('now'))
  `).run(uuidv4(), item.campaign_id, item.lead_id, JSON.stringify({ reason }));

  res.json({ success: true });
});

// Schedule a response
router.post('/:id/schedule', (req, res) => {
  const db = getDb();
  const { scheduled_for } = req.body;
  if (!scheduled_for) return res.status(400).json({ error: 'scheduled_for is required' });

  const item = db.prepare('SELECT * FROM generated_responses WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  db.prepare('UPDATE generated_responses SET scheduled_for = ? WHERE id = ?').run(scheduled_for, req.params.id);
  res.json({ success: true, scheduled_for });
});

function parseQueueItem(item) {
  return {
    ...item,
    analysis: tryParse(item.analysis, null),
  };
}

function tryParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

module.exports = router;
