const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// List leads with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { status, campaign_id, limit = 50, offset = 0, date_from, date_to } = req.query;

  let query = `
    SELECT rl.*,
      c.name as campaign_name,
      c.product_name,
      gr.id as response_id,
      gr.status as response_status,
      gr.response_text,
      gr.edited_text,
      gr.posted_at,
      gr.reddit_comment_id
    FROM reddit_leads rl
    LEFT JOIN campaigns c ON c.id = rl.campaign_id
    LEFT JOIN generated_responses gr ON gr.lead_id = rl.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND rl.status = ?';
    params.push(status);
  }
  if (campaign_id) {
    query += ' AND rl.campaign_id = ?';
    params.push(campaign_id);
  }
  if (date_from) {
    query += ' AND rl.found_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    query += ' AND rl.found_at <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY rl.found_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const leads = db.prepare(query).all(...params);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM reddit_leads rl
    WHERE 1=1
    ${status ? 'AND rl.status = ?' : ''}
    ${campaign_id ? 'AND rl.campaign_id = ?' : ''}
  `).get(...params.slice(0, -2)).count;

  res.json({
    leads: leads.map(parseLead),
    total,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
});

// Get single lead
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare(`
    SELECT rl.*,
      c.name as campaign_name, c.product_name,
      gr.id as response_id, gr.status as response_status,
      gr.response_text, gr.edited_text, gr.claude_reasoning,
      gr.posted_at, gr.reddit_comment_id
    FROM reddit_leads rl
    LEFT JOIN campaigns c ON c.id = rl.campaign_id
    LEFT JOIN generated_responses gr ON gr.lead_id = rl.id
    WHERE rl.id = ?
  `).get(req.params.id);

  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(parseLead(lead));
});

// Update lead status/notes
router.put('/:id', (req, res) => {
  const db = getDb();
  const { status, notes } = req.body;
  const allowed = ['pending_review', 'posted', 'replied', 'converted', 'rejected'];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
  }

  const updates = [];
  const values = [];

  if (status) { updates.push('status = ?'); values.push(status); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE reddit_leads SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const lead = db.prepare('SELECT * FROM reddit_leads WHERE id = ?').get(req.params.id);
  res.json(parseLead(lead));
});

function parseLead(l) {
  return {
    ...l,
    analysis: tryParse(l.analysis, null),
    claude_reasoning: tryParse(l.claude_reasoning, null),
  };
}

function tryParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

module.exports = router;
