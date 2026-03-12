const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Dashboard stats
router.get('/', (req, res) => {
  const db = getDb();

  const stats = {
    leads_found: db.prepare("SELECT COUNT(*) as c FROM reddit_leads").get().c,
    leads_today: db.prepare("SELECT COUNT(*) as c FROM reddit_leads WHERE date(found_at) = date('now')").get().c,
    pending_review: db.prepare("SELECT COUNT(*) as c FROM generated_responses WHERE status = 'pending'").get().c,
    posted: db.prepare("SELECT COUNT(*) as c FROM generated_responses WHERE status = 'approved'").get().c,
    rejected: db.prepare("SELECT COUNT(*) as c FROM generated_responses WHERE status = 'rejected'").get().c,
    converted: db.prepare("SELECT COUNT(*) as c FROM reddit_leads WHERE status = 'converted'").get().c,
    active_campaigns: db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active'").get().c,
    avg_relevance_score: db.prepare("SELECT AVG(relevance_score) as avg FROM reddit_leads").get().avg || 0,
  };

  // Conversion funnel
  stats.funnel = {
    found: stats.leads_found,
    reviewed: db.prepare("SELECT COUNT(*) as c FROM generated_responses WHERE status != 'pending'").get().c,
    posted: stats.posted,
    replied: db.prepare("SELECT COUNT(*) as c FROM reddit_leads WHERE status = 'replied'").get().c,
    converted: stats.converted,
  };

  // Top subreddits
  stats.top_subreddits = db.prepare(`
    SELECT subreddit, COUNT(*) as lead_count,
      AVG(relevance_score) as avg_score
    FROM reddit_leads
    GROUP BY subreddit
    ORDER BY lead_count DESC
    LIMIT 10
  `).all();

  // Response style performance
  stats.style_performance = db.prepare(`
    SELECT c.response_style,
      COUNT(gr.id) as total,
      SUM(CASE WHEN gr.status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN gr.status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM campaigns c
    LEFT JOIN reddit_leads rl ON rl.campaign_id = c.id
    LEFT JOIN generated_responses gr ON gr.lead_id = rl.id
    GROUP BY c.response_style
  `).all();

  res.json(stats);
});

// Time series data for charts
router.get('/charts', (req, res) => {
  const db = getDb();
  const days = parseInt(req.query.days) || 30;

  // Leads per day
  const leadsPerDay = db.prepare(`
    SELECT date(found_at) as date, COUNT(*) as count
    FROM reddit_leads
    WHERE found_at >= date('now', '-${days} days')
    GROUP BY date(found_at)
    ORDER BY date ASC
  `).all();

  // Posts per day
  const postsPerDay = db.prepare(`
    SELECT date(posted_at) as date, COUNT(*) as count
    FROM generated_responses
    WHERE status = 'approved'
      AND posted_at >= date('now', '-${days} days')
    GROUP BY date(posted_at)
    ORDER BY date ASC
  `).all();

  // Fill in missing dates
  const allDates = generateDateRange(days);
  const leadsMap = Object.fromEntries(leadsPerDay.map(r => [r.date, r.count]));
  const postsMap = Object.fromEntries(postsPerDay.map(r => [r.date, r.count]));

  const series = allDates.map(date => ({
    date,
    leads: leadsMap[date] || 0,
    posts: postsMap[date] || 0,
  }));

  res.json({ series, days });
});

// Campaign analytics
router.get('/campaigns/:id', (req, res) => {
  const db = getDb();
  const campaignId = req.params.id;

  const stats = {
    total_leads: db.prepare("SELECT COUNT(*) as c FROM reddit_leads WHERE campaign_id = ?").get(campaignId).c,
    leads_today: db.prepare("SELECT COUNT(*) as c FROM reddit_leads WHERE campaign_id = ? AND date(found_at) = date('now')").get(campaignId).c,
    avg_score: db.prepare("SELECT AVG(relevance_score) as avg FROM reddit_leads WHERE campaign_id = ?").get(campaignId).avg || 0,

    responses: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },

    recent_runs: db.prepare(`
      SELECT * FROM agent_runs
      WHERE campaign_id = ?
      ORDER BY started_at DESC
      LIMIT 10
    `).all(campaignId),
  };

  const responseCounts = db.prepare(`
    SELECT gr.status, COUNT(*) as c
    FROM generated_responses gr
    JOIN reddit_leads rl ON rl.id = gr.lead_id
    WHERE rl.campaign_id = ?
    GROUP BY gr.status
  `).all(campaignId);

  for (const row of responseCounts) {
    stats.responses[row.status] = row.c;
  }

  res.json(stats);
});

function generateDateRange(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

module.exports = router;
