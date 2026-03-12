const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { runAgentForCampaign, getAgentState } = require('../agent');

const router = express.Router();

// List all campaigns
router.get('/', (req, res) => {
  const db = getDb();
  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM reddit_leads WHERE campaign_id = c.id) as total_leads,
      (SELECT COUNT(*) FROM reddit_leads WHERE campaign_id = c.id AND date(found_at) = date('now')) as leads_today,
      (SELECT COUNT(*) FROM reddit_leads rl
        JOIN generated_responses gr ON gr.lead_id = rl.id
        WHERE rl.campaign_id = c.id AND gr.status = 'pending') as queue_count,
      (SELECT started_at FROM agent_runs WHERE campaign_id = c.id ORDER BY started_at DESC LIMIT 1) as last_run_at
    FROM campaigns c
    ORDER BY c.created_at DESC
  `).all();

  res.json(campaigns.map(parseCampaign));
});

// Get single campaign
router.get('/:id', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(parseCampaign(campaign));
});

// Create campaign
router.post('/', (req, res) => {
  const db = getDb();
  const {
    name, product_name, product_description, icp, pain_points,
    subreddits, keywords, response_style = 'helpful_expert',
    warmup_mode = false, warmup_days_remaining = 14,
  } = req.body;

  if (!name || !product_name || !product_description || !icp || !pain_points || !subreddits || !keywords) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO campaigns (id, name, product_name, product_description, icp, pain_points, subreddits, keywords, response_style, status, warmup_mode, warmup_days_remaining)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    id, name, product_name, product_description, icp, pain_points,
    JSON.stringify(Array.isArray(subreddits) ? subreddits : [subreddits]),
    JSON.stringify(Array.isArray(keywords) ? keywords : [keywords]),
    response_style,
    warmup_mode ? 1 : 0,
    warmup_days_remaining
  );

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  res.status(201).json(parseCampaign(campaign));
});

// Update campaign
router.put('/:id', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const fields = ['name', 'product_name', 'product_description', 'icp', 'pain_points', 'response_style', 'status', 'warmup_mode', 'warmup_days_remaining'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(field === 'warmup_mode' ? (req.body[field] ? 1 : 0) : req.body[field]);
    }
  }

  if (req.body.subreddits !== undefined) {
    updates.push('subreddits = ?');
    values.push(JSON.stringify(Array.isArray(req.body.subreddits) ? req.body.subreddits : [req.body.subreddits]));
  }

  if (req.body.keywords !== undefined) {
    updates.push('keywords = ?');
    values.push(JSON.stringify(Array.isArray(req.body.keywords) ? req.body.keywords : [req.body.keywords]));
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json(parseCampaign(updated));
});

// Delete campaign
router.delete('/:id', (req, res) => {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Trigger agent manually
router.post('/:id/run', async (req, res) => {
  const state = getAgentState();
  if (state.running) {
    return res.status(409).json({ error: 'Agent is already running' });
  }

  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Run async — don't await
  runAgentForCampaign(req.params.id).catch(err => {
    console.error('[Route] Agent run error:', err.message);
  });

  res.json({ success: true, message: 'Agent started' });
});

function parseCampaign(c) {
  return {
    ...c,
    subreddits: tryParse(c.subreddits, []),
    keywords: tryParse(c.keywords, []),
    warmup_mode: c.warmup_mode === 1 || c.warmup_mode === true,
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = router;
