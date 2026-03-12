import React, { useContext, useState } from 'react';
import { api } from '../api';
import { ToastContext } from '../App';

export default function CampaignCard({ campaign, onUpdate, onDelete }) {
  const { addToast } = useContext(ToastContext);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      await api.runCampaign(campaign.id);
      addToast(`Agent started for "${campaign.name}"`, 'success');
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  }

  async function handleToggle() {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await api.updateCampaign(campaign.id, { status: newStatus });
      onUpdate?.();
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteCampaign(campaign.id);
      onDelete?.();
      addToast('Campaign deleted', 'success');
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  }

  const subreddits = Array.isArray(campaign.subreddits) ? campaign.subreddits : [];

  return (
    <div className="card hover:border-accent/30 transition-colors group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-serif text-base text-text">{campaign.name}</h3>
            {campaign.warmup_mode && (
              <span className="badge bg-purple-900/30 text-purple-400 border border-purple-900/50">warmup</span>
            )}
          </div>
          <p className="text-xs text-text-dim">{campaign.product_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={campaign.status === 'active' ? 'badge-active' : 'badge-paused'}>
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Subreddits */}
      <div className="flex flex-wrap gap-1 mb-3">
        {subreddits.slice(0, 5).map(sub => (
          <span key={sub} className="text-xs text-accent bg-accent/5 border border-accent/15 px-1.5 py-0.5 rounded">
            r/{sub}
          </span>
        ))}
        {subreddits.length > 5 && (
          <span className="text-xs text-muted">+{subreddits.length - 5} more</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted">Total leads</p>
          <p className="text-lg font-bold text-text tabular-nums">{campaign.total_leads || 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Today</p>
          <p className="text-lg font-bold text-accent tabular-nums">{campaign.leads_today || 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted">In queue</p>
          <p className="text-lg font-bold text-blue-400 tabular-nums">{campaign.queue_count || 0}</p>
        </div>
      </div>

      {/* Last run */}
      {campaign.last_run_at && (
        <p className="text-xs text-muted mb-3">
          Last run: {new Date(campaign.last_run_at).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={handleRun}
          disabled={running || campaign.status !== 'active'}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          {running ? (
            <>
              <span className="inline-block w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              Running...
            </>
          ) : '▶ Run Agent'}
        </button>

        <button onClick={handleToggle} className="btn-ghost text-xs">
          {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
        </button>

        <button
          onClick={handleDelete}
          className="ml-auto text-xs text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          ✕ Delete
        </button>
      </div>
    </div>
  );
}
