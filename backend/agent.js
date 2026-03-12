const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');
const { scoreLead, analyzeLead, generateResponse, generateWarmupComment } = require('./claude');
const { searchSubreddit, getMockLeads, isConfigured } = require('./reddit');

const agentState = {
  running: false,
  currentCampaignId: null,
  lastRunAt: null,
  nextRunAt: null,
  lastRunStats: null,
};

function getAgentState() {
  return { ...agentState };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAgentForCampaign(campaignId) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status !== 'active') return { skipped: true, reason: 'Campaign is not active' };

  const runId = uuidv4();
  db.prepare(`
    INSERT INTO agent_runs (id, campaign_id, status, started_at)
    VALUES (?, ?, 'running', datetime('now'))
  `).run(runId, campaignId);

  agentState.running = true;
  agentState.currentCampaignId = campaignId;

  let leadsFound = 0;
  let responsesGenerated = 0;

  try {
    const subreddits = JSON.parse(campaign.subreddits);
    const keywords = JSON.parse(campaign.keywords);
    const demoMode = !isConfigured();

    console.log(`[Agent] Running campaign "${campaign.name}" | Demo: ${demoMode}`);

    // Get settings
    const sigRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('signature');
    const signature = sigRow?.value || '';

    for (const subreddit of subreddits) {
      let posts;

      if (demoMode) {
        posts = getMockLeads([subreddit], keywords).slice(0, 3);
      } else {
        posts = await searchSubreddit({ subreddit, keywords, limit: 20 });
        await sleep(2000);
      }

      console.log(`[Agent] Found ${posts.length} posts in r/${subreddit}`);

      for (const post of posts) {
        // Check if we already have this post
        const existing = db.prepare(
          'SELECT id FROM reddit_leads WHERE reddit_post_id = ? AND campaign_id = ?'
        ).get(post.id, campaignId);

        if (existing) continue;

        // Step 1: Score the lead
        let scoreResult;
        try {
          scoreResult = await scoreLead({
            product_name: campaign.product_name,
            product_description: campaign.product_description,
            icp: campaign.icp,
            pain_points: campaign.pain_points,
            subreddit: post.subreddit,
            title: post.title,
            content: post.content,
          });
          await sleep(1000);
        } catch (err) {
          console.error(`[Agent] Score failed for post ${post.id}:`, err.message);
          continue;
        }

        if (scoreResult.score < 7) {
          console.log(`[Agent] Skipping post ${post.id} — score ${scoreResult.score}`);
          continue;
        }

        leadsFound++;

        // Save the lead
        const leadId = uuidv4();
        db.prepare(`
          INSERT INTO reddit_leads (id, campaign_id, reddit_post_id, subreddit, post_title, post_url, post_content, author, relevance_score, analysis, status, found_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', datetime('now'))
        `).run(
          leadId,
          campaignId,
          post.id,
          post.subreddit,
          post.title,
          post.url,
          post.content || '',
          post.author || 'unknown',
          scoreResult.score,
          JSON.stringify(scoreResult)
        );

        // Log event
        logEvent(db, campaignId, leadId, 'lead_found', { score: scoreResult.score, subreddit: post.subreddit });

        // If in warmup mode, skip response generation
        if (campaign.warmup_mode) {
          console.log(`[Agent] Warmup mode — skipping response for post ${post.id}`);
          continue;
        }

        // Step 2: Analyze the lead
        let analysis;
        try {
          analysis = await analyzeLead({
            product_name: campaign.product_name,
            subreddit: post.subreddit,
            title: post.title,
            content: post.content,
          });
          await sleep(1000);
        } catch (err) {
          console.error(`[Agent] Analysis failed for lead ${leadId}:`, err.message);
          analysis = scoreResult; // fallback to score result
        }

        // Update lead with deeper analysis
        db.prepare('UPDATE reddit_leads SET analysis = ? WHERE id = ?').run(
          JSON.stringify({ score: scoreResult, analysis }),
          leadId
        );

        // Step 3: Generate response
        let responseText;
        try {
          responseText = await generateResponse({
            product_name: campaign.product_name,
            response_style: campaign.response_style,
            subreddit: post.subreddit,
            post_content: `Title: ${post.title}\n\n${post.content}`,
            analysis,
            signature,
          });
          await sleep(1500);
        } catch (err) {
          console.error(`[Agent] Response generation failed for lead ${leadId}:`, err.message);
          continue;
        }

        // Save to review queue
        const responseId = uuidv4();
        db.prepare(`
          INSERT INTO generated_responses (id, lead_id, response_text, claude_reasoning, status, created_at)
          VALUES (?, ?, ?, ?, 'pending', datetime('now'))
        `).run(
          responseId,
          leadId,
          responseText,
          JSON.stringify({ score: scoreResult, analysis })
        );

        responsesGenerated++;
        logEvent(db, campaignId, leadId, 'response_generated', { responseId });

        console.log(`[Agent] Generated response for lead ${leadId}`);
      }
    }

    // Finalize run
    db.prepare(`
      UPDATE agent_runs
      SET status = 'completed', leads_found = ?, responses_generated = ?, finished_at = datetime('now')
      WHERE id = ?
    `).run(leadsFound, responsesGenerated, runId);

    agentState.lastRunAt = new Date().toISOString();
    agentState.lastRunStats = { leadsFound, responsesGenerated, campaignId };

    return { success: true, leadsFound, responsesGenerated };
  } catch (err) {
    console.error('[Agent] Fatal error:', err);

    db.prepare(`
      UPDATE agent_runs
      SET status = 'failed', error = ?, finished_at = datetime('now')
      WHERE id = ?
    `).run(err.message, runId);

    throw err;
  } finally {
    agentState.running = false;
    agentState.currentCampaignId = null;
  }
}

async function runAllActiveCampaigns() {
  if (agentState.running) {
    console.log('[Agent] Already running, skipping scheduled run');
    return;
  }

  const db = getDb();
  const campaigns = db.prepare("SELECT id FROM campaigns WHERE status = 'active'").all();

  console.log(`[Agent] Scheduled run — ${campaigns.length} active campaigns`);

  for (const campaign of campaigns) {
    try {
      await runAgentForCampaign(campaign.id);
    } catch (err) {
      console.error(`[Agent] Campaign ${campaign.id} failed:`, err.message);
    }
  }
}

function logEvent(db, campaignId, leadId, eventType, metadata) {
  db.prepare(`
    INSERT INTO events (id, campaign_id, lead_id, event_type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), campaignId, leadId, eventType, JSON.stringify(metadata));
}

module.exports = { runAgentForCampaign, runAllActiveCampaigns, getAgentState };
