const { getDb } = require('./database');

const RATE_LIMIT_DELAY = 2500; // ms between calls
let lastCallTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - elapsed);
  }
  lastCallTime = Date.now();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRedditConfig() {
  const db = getDb();
  const get = key => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || process.env[key.toUpperCase()] || '';

  return {
    clientId: get('reddit_client_id'),
    clientSecret: get('reddit_client_secret'),
    username: get('reddit_username'),
    password: get('reddit_password'),
  };
}

function isConfigured() {
  const { clientId, clientSecret, username, password } = getRedditConfig();
  return !!(clientId && clientSecret && username && password);
}

async function getSnoowrapClient() {
  const cfg = getRedditConfig();
  if (!cfg.clientId) return null;

  try {
    const snoowrap = require('snoowrap');
    const r = new snoowrap({
      userAgent: 'LeadLoop/1.0.0 (lead generation tool)',
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      username: cfg.username,
      password: cfg.password,
    });
    r.config({ requestDelay: 1000, continueAfterRatelimitError: false });
    return r;
  } catch (err) {
    console.error('[Reddit] Failed to initialize snoowrap:', err.message);
    return null;
  }
}

async function searchSubreddit({ subreddit, keywords, limit = 25 }) {
  await rateLimit();

  const query = Array.isArray(keywords) ? keywords.join(' OR ') : keywords;
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&restrict_sr=1&t=week`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LeadLoop/1.0.0' },
    });

    if (!res.ok) {
      throw new Error(`Reddit API returned ${res.status}`);
    }

    const json = await res.json();
    const posts = (json.data?.children || []).map(child => {
      const p = child.data;
      return {
        id: p.id,
        subreddit: p.subreddit,
        title: p.title,
        url: `https://www.reddit.com${p.permalink}`,
        content: p.selftext || '',
        author: p.author,
        score: p.score,
        created_utc: p.created_utc,
        num_comments: p.num_comments,
      };
    });

    // Filter out posts older than 48 hours
    const cutoff = Date.now() / 1000 - 48 * 3600;
    return posts.filter(p => p.created_utc > cutoff);
  } catch (err) {
    console.error(`[Reddit] Search failed for r/${subreddit}:`, err.message);
    return [];
  }
}

async function postComment({ postUrl, text }) {
  const r = await getSnoowrapClient();
  if (!r) {
    throw new Error('Reddit credentials not configured. Configure them in Settings.');
  }

  await rateLimit();

  try {
    // Extract post ID from URL
    const match = postUrl.match(/comments\/([a-z0-9]+)\//i);
    if (!match) throw new Error('Could not parse post ID from URL');

    const submission = r.getSubmission(match[1]);
    const comment = await submission.reply(text);
    return { commentId: comment.id, url: `https://www.reddit.com${comment.permalink}` };
  } catch (err) {
    console.error('[Reddit] Post comment failed:', err.message);
    throw err;
  }
}

async function upvotePost({ postId }) {
  const r = await getSnoowrapClient();
  if (!r) return false;

  await rateLimit();
  try {
    await r.getSubmission(postId).upvote();
    return true;
  } catch (err) {
    console.error('[Reddit] Upvote failed:', err.message);
    return false;
  }
}

async function testAuth() {
  const r = await getSnoowrapClient();
  if (!r) return { success: false, error: 'Reddit credentials not configured' };

  try {
    const me = await r.getMe();
    return {
      success: true,
      username: me.name,
      karma: me.link_karma + me.comment_karma,
      account_age_days: Math.floor((Date.now() / 1000 - me.created_utc) / 86400),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Mock data for demo mode
function getMockLeads(subreddits, keywords) {
  const mockPosts = [
    {
      id: 'mock_1',
      subreddit: subreddits[0] || 'SaaS',
      title: 'Looking for a tool to automate my lead gen workflow',
      url: 'https://reddit.com/r/SaaS/comments/mock_1',
      content: "I've been spending 3+ hours a day manually searching Reddit for potential customers. There has to be a better way. We're a B2B SaaS in the project management space. Has anyone automated this?",
      author: 'founder_jane',
      score: 47,
      created_utc: Date.now() / 1000 - 3600,
      num_comments: 12,
    },
    {
      id: 'mock_2',
      subreddit: subreddits[1] || 'entrepreneur',
      title: 'My outreach open rate is terrible - what am I doing wrong?',
      url: 'https://reddit.com/r/entrepreneur/comments/mock_2',
      content: "Cold email open rates around 8%. I know my ICP, I know the pain points, but something isn't connecting. Looking for advice from people who've actually cracked B2B outreach.",
      author: 'startup_tom',
      score: 89,
      created_utc: Date.now() / 1000 - 7200,
      num_comments: 34,
    },
    {
      id: 'mock_3',
      subreddit: subreddits[0] || 'startups',
      title: 'Reddit as a customer acquisition channel - anyone doing it successfully?',
      url: 'https://reddit.com/r/startups/comments/mock_3',
      content: "We tried paid ads, cold email, LinkedIn. Reddit feels like it could work for us since our customers hang out there, but we don't want to get banned for spam. Curious how others approach this.",
      author: 'growthmarketers',
      score: 156,
      created_utc: Date.now() / 1000 - 10800,
      num_comments: 67,
    },
    {
      id: 'mock_4',
      subreddit: 'indiehackers',
      title: 'How do you find your first 100 customers?',
      url: 'https://reddit.com/r/indiehackers/comments/mock_4',
      content: "Just launched my SaaS last month. Got 3 beta users from my network. Struggling with where to find the next wave. Product is solid, conversion from demo is good. Discovery is the problem.",
      author: 'indie_mike',
      score: 203,
      created_utc: Date.now() / 1000 - 14400,
      num_comments: 89,
    },
    {
      id: 'mock_5',
      subreddit: subreddits[0] || 'SaaS',
      title: 'Is manual Reddit prospecting worth the time?',
      url: 'https://reddit.com/r/SaaS/comments/mock_5',
      content: "We assign one person 2 hours per day to find Reddit conversations to join. Getting some traction but can't tell if ROI is there. Anyone track this properly?",
      author: 'b2b_marketer',
      score: 31,
      created_utc: Date.now() / 1000 - 18000,
      num_comments: 8,
    },
  ];

  return mockPosts;
}

module.exports = { searchSubreddit, postComment, upvotePost, testAuth, isConfigured, getMockLeads };
