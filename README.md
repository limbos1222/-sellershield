# LeadLoop — AI-Powered Reddit Lead Generation

Find and engage with potential customers on Reddit using Claude AI.

## What It Does

LeadLoop monitors Reddit subreddits for posts that match your ideal customer profile, uses Claude AI to analyze relevance and generate authentic responses, then queues them for your review before any posting happens.

**Pipeline:**
1. Agent scans target subreddits every 30 minutes
2. Claude scores each post 1–10 for lead quality
3. Claude writes a helpful, human-sounding response
4. You review, edit, approve, or reject in the queue
5. Approved responses post via Reddit API (or you copy-paste)

---

## Setup

### 1. Install Dependencies

```bash
# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` in the `backend/` folder:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...       # Required — get from console.anthropic.com
REDDIT_CLIENT_ID=                   # Optional — see Reddit setup below
REDDIT_CLIENT_SECRET=               # Optional
REDDIT_USERNAME=                    # Optional
REDDIT_PASSWORD=                    # Optional
PORT=3001
```

If Reddit credentials are not set, the app runs in **Demo Mode** with mock data.

---

### 3. Reddit App Setup (Optional but Recommended)

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click **"create another app..."**
3. Select type: **script**
4. Name: `LeadLoop` (or anything)
5. Redirect URI: `http://localhost:3001`
6. Click **Create app**
7. Copy the **client ID** (under the app name) and **client secret**

Add your Reddit account username and password to `.env`.

> **Note:** Use a dedicated Reddit account for lead gen, not your personal account.

---

### 4. Run the App

```bash
# From the root directory
npm run dev
```

This starts:
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:5173`

---

## First Run

1. Open `http://localhost:5173`
2. Go to **Settings** and enter your API keys
3. Create a **Campaign** — add your product, ICP, subreddits, and keywords
4. Click **Run Agent** on the campaign to trigger the first scan
5. Review generated responses in the **Queue**

---

## Key Concepts

**Campaign** — defines what you're looking for (product, ICP, subreddits, keywords)

**Lead** — a Reddit post the agent identified as relevant

**Queue** — generated responses waiting for your approval before posting

**Warm-up Mode** — for new Reddit accounts; agent only upvotes and posts helpful comments for 2 weeks to build karma

---

## Response Styles

- `helpful_expert` — detailed, technical, authoritative
- `casual_founder` — conversational, shares experience, relatable
- `subtle_mention` — focuses on solving the problem, product mention is minimal

---

## Rate Limits & Safety

- Max 60 Reddit API calls/minute (enforced)
- 2–3 second delays between calls
- **Nothing posts automatically** — every response requires manual approval
- Auto-posting can be enabled in Settings after explicit confirmation

---

## Project Structure

```
leadloop/
├── backend/
│   ├── server.js       Express app
│   ├── database.js     SQLite setup + schema
│   ├── agent.js        Reddit scanning + lead scoring pipeline
│   ├── claude.js       All Anthropic API calls
│   ├── reddit.js       Reddit API wrapper + public fallback
│   ├── scheduler.js    Cron jobs
│   └── routes/         API route handlers
├── frontend/
│   └── src/
│       ├── components/ Reusable UI components
│       └── pages/      Full page views
└── package.json        Monorepo scripts
```
