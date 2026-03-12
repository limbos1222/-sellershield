const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Campaigns
  getCampaigns: () => request('/campaigns'),
  getCampaign: id => request(`/campaigns/${id}`),
  createCampaign: data => request('/campaigns', { method: 'POST', body: data }),
  updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: data }),
  deleteCampaign: id => request(`/campaigns/${id}`, { method: 'DELETE' }),
  runCampaign: id => request(`/campaigns/${id}/run`, { method: 'POST' }),

  // Agent
  getAgentStatus: () => request('/agent/status'),

  // Leads
  getLeads: params => request(`/leads?${new URLSearchParams(params || {})}`),
  getLead: id => request(`/leads/${id}`),
  updateLead: (id, data) => request(`/leads/${id}`, { method: 'PUT', body: data }),

  // Queue
  getQueue: params => request(`/queue?${new URLSearchParams(params || {})}`),
  approveResponse: id => request(`/queue/${id}/approve`, { method: 'POST' }),
  editResponse: (id, text) => request(`/queue/${id}/edit`, { method: 'POST', body: { text } }),
  rejectResponse: (id, reason) => request(`/queue/${id}/reject`, { method: 'POST', body: { reason } }),
  scheduleResponse: (id, scheduled_for) => request(`/queue/${id}/schedule`, { method: 'POST', body: { scheduled_for } }),

  // Analytics
  getAnalytics: () => request('/analytics'),
  getCharts: (days = 30) => request(`/analytics/charts?days=${days}`),
  getCampaignAnalytics: id => request(`/analytics/campaigns/${id}`),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: data => request('/settings', { method: 'PUT', body: data }),
  testReddit: () => request('/settings/test-reddit', { method: 'POST' }),
};
