import React, { useEffect, useState, useContext } from 'react';
import ReviewModal from '../components/ReviewModal';
import { api } from '../api';
import { ToastContext } from '../App';

export default function Queue() {
  const { addToast } = useContext(ToastContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState('');

  useEffect(() => { load(); }, [filterCampaign]);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filterCampaign) params.campaign_id = filterCampaign;
      const [queueData, campaignData] = await Promise.all([
        api.getQueue(params),
        api.getCampaigns(),
      ]);
      setItems(queueData);
      setCampaigns(campaignData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function quickApprove(item, e) {
    e.stopPropagation();
    try {
      await api.approveResponse(item.id);
      addToast('Approved!', 'success');
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  }

  async function quickReject(item, e) {
    e.stopPropagation();
    try {
      await api.rejectResponse(item.id, 'quick reject');
      addToast('Rejected', 'info');
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-text">Review Queue</h1>
          <p className="text-xs text-text-dim mt-0.5">
            {items.length} response{items.length !== 1 ? 's' : ''} waiting for review
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="input w-auto text-xs"
            value={filterCampaign}
            onChange={e => setFilterCampaign(e.target.value)}
          >
            <option value="">All campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={load} className="btn-ghost text-xs">⟳ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-dim text-xs">Loading queue...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">◉</p>
          <p className="text-sm text-text-dim mb-1">Queue is empty</p>
          <p className="text-xs text-muted">Run an agent on a campaign to generate responses for review.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="card hover:border-accent/20 cursor-pointer transition-all group animate-slide-in"
              onClick={() => setSelected(item)}
            >
              <div className="flex items-center gap-4">
                {/* Score */}
                <span className={`score-pill flex-shrink-0 ${item.relevance_score >= 9 ? 'score-high' : 'score-med'}`}>
                  {item.relevance_score}
                </span>

                {/* Subreddit + title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-accent text-xs">r/{item.subreddit}</span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-muted text-xs">u/{item.author}</span>
                    {item.campaign_name && (
                      <>
                        <span className="text-muted text-xs">·</span>
                        <span className="text-text-dim text-xs">{item.campaign_name}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-text truncate">{item.post_title}</p>
                </div>

                {/* Response preview */}
                <div className="hidden md:block w-64 flex-shrink-0">
                  <p className="text-xs text-text-dim line-clamp-2 leading-relaxed">
                    {item.edited_text || item.response_text}
                  </p>
                </div>

                {/* Time */}
                <span className="text-xs text-muted flex-shrink-0 hidden lg:block">
                  {formatTime(item.created_at)}
                </span>

                {/* Quick actions */}
                <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => quickApprove(item, e)}
                    className="w-7 h-7 bg-green-900/30 hover:bg-green-700 text-green-400 hover:text-white rounded text-xs transition-colors"
                    title="Quick approve"
                  >
                    ✓
                  </button>
                  <button
                    onClick={e => quickReject(item, e)}
                    className="w-7 h-7 bg-red-900/30 hover:bg-red-700 text-red-400 hover:text-white rounded text-xs transition-colors"
                    title="Quick reject"
                  >
                    ✕
                  </button>
                </div>

                <span className="text-muted text-xs flex-shrink-0 group-hover:text-text-dim">→</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ReviewModal
          item={selected}
          onClose={() => setSelected(null)}
          onAction={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}
