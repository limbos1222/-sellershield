const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./database');

function getClient() {
  const db = getDb();
  const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key');
  const apiKey = keyRow?.value || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Add it in Settings.');
  }

  return new Anthropic({ apiKey });
}

async function scoreLead({ product_name, product_description, icp, pain_points, subreddit, title, content }) {
  const client = getClient();

  const prompt = `You are analyzing Reddit posts to find potential customers for a SaaS product.

Product: ${product_name}
Description: ${product_description}
ICP: ${icp}
Pain points solved: ${pain_points}

Reddit post:
Subreddit: r/${subreddit}
Title: ${title}
Content: ${content || '(no body text)'}

Score this post's relevance as a lead from 1-10.
Consider: Does the person have the pain point our product solves? Are they actively looking for solutions? Is this a decision-maker or our ICP?

Respond in JSON only, no markdown:
{"score": 8, "reasoning": "...", "pain_point": "...", "opportunity": "..."}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Strip markdown code blocks if present
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeLead({ product_name, subreddit, title, content }) {
  const client = getClient();

  const prompt = `Analyze this Reddit post to understand the lead opportunity.

Post:
Subreddit: r/${subreddit}
Title: ${title}
Content: ${content || '(no body text)'}

Answer in JSON only, no markdown:
{
  "exact_problem": "...",
  "desired_solution": "...",
  "best_angle": "...",
  "confidence": 8,
  "is_genuine_lead": true
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function generateResponse({ product_name, response_style, subreddit, post_content, analysis, signature }) {
  const client = getClient();

  const styleDescriptions = {
    helpful_expert: 'a helpful expert who built',
    casual_founder: 'a casual founder who built',
    subtle_mention: 'a community member who also happens to have built',
  };

  const styleDesc = styleDescriptions[response_style] || styleDescriptions.helpful_expert;
  const sigText = signature ? `\n\nIf you mention the product, append this signature naturally: ${signature}` : '';

  const prompt = `You are ${styleDesc} ${product_name}. Write a Reddit comment responding to this post.

Rules:
- Help genuinely first. Be specific and useful.
- Only mention ${product_name} if it's a natural fit. Never force it.
- Sound like a real human, not marketing copy.
- Match r/${subreddit} culture (check the tone of the post)
- 3-5 sentences max unless a longer answer genuinely helps
- Never start with "I"
- No exclamation marks
- If mentioning the product, share a specific result or feature, not a sales pitch${sigText}

Post to respond to:
${post_content}

Analysis context:
${JSON.stringify(analysis, null, 2)}

Write only the comment text, nothing else.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

async function generateWarmupComment({ subreddit, post_content }) {
  const client = getClient();

  const prompt = `Write a genuine, helpful Reddit comment for this post. You are just a regular Reddit user being helpful.

Subreddit: r/${subreddit}
Post: ${post_content}

Rules:
- Be genuinely helpful, not promotional
- 2-3 sentences max
- Sound natural and human
- No product mentions whatsoever
- Never start with "I"

Write only the comment text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

module.exports = { scoreLead, analyzeLead, generateResponse, generateWarmupComment };
