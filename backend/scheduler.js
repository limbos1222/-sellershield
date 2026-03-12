const cron = require('node-cron');
const { runAllActiveCampaigns, getAgentState } = require('./agent');

let scheduledTask = null;

function startScheduler() {
  // Run every 30 minutes
  scheduledTask = cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Triggering agent run...');
    try {
      await runAllActiveCampaigns();
    } catch (err) {
      console.error('[Scheduler] Agent run failed:', err.message);
    }
  });

  // Calculate next run time
  updateNextRunTime();
  console.log('[Scheduler] Started — agent runs every 30 minutes');
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.destroy();
    scheduledTask = null;
    console.log('[Scheduler] Stopped');
  }
}

function updateNextRunTime() {
  const state = getAgentState();
  const now = new Date();
  const next = new Date(now.getTime() + 30 * 60 * 1000);
  state.nextRunAt = next.toISOString();
}

module.exports = { startScheduler, stopScheduler };
