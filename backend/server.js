require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./database');
const { getAgentState } = require('./agent');
const { startScheduler } = require('./scheduler');
const { isConfigured } = require('./reddit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

// Agent status endpoint
app.get('/api/agent/status', (req, res) => {
  const state = getAgentState();
  res.json({
    ...state,
    demo_mode: !isConfigured(),
  });
});

// Reddit auth test (legacy path)
app.post('/api/reddit/test-auth', async (req, res) => {
  const { testAuth } = require('./reddit');
  try {
    const result = await testAuth();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Init database
getDb();
console.log('[DB] SQLite initialized');

// Start server
app.listen(PORT, () => {
  console.log(`[Server] LeadLoop backend running on http://localhost:${PORT}`);
  console.log(`[Server] Demo mode: ${!isConfigured()}`);
  startScheduler();
});
