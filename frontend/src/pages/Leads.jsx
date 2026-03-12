import React, { useEffect, useState } from 'react';
import LeadTable from '../components/LeadTable';
import { api } from '../api';

const STATUS_OPTIONS = ['', 'pending_review', 'posted', 'replied', 'converted', 'rejected'];

function LeadDetail({ lead, onClose, onUpdate }) {
  const analysis = lead.analysis ? (typeof lead.analysis === 'string' ? JSON.parse(lead.analysis) : lead.analysis) : null;
  const reasoning = lead.claude_reasoning ? (typeof lead.claude_reasoning === 'string' ? JSON.parse(lead.claude_reasoning) : lead.claude_reasoning) : null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-end z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-surface border-l border-border flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-serif text-sm text-text">Lead Detail</h3>
          <button onClick={onClose} className="text-muted hover:text-text">×</button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <p className="label">Post</p>
            <a href={lead.post_url} target="_blank" rel="noreferrer" className="text-xs text-text hover:text-accent leading-snug">
              {lead.post_title}
            </a>
            <p className="text-xs text-muted mt-1">r/{lead.subreddit} · u/{lead.author}</p>
          </div>

          {lead.post_content && (
            <div>
              <p className="label">Content</p>
              <p className="text-xs text-text-dim leading-relaxed line-clamp-6">{lead.post_content}</p>
            </div>
          )}

          {analysis && (
            <div>
              <p className="label">AI Analysis</p>
              <div className="bg-bg border border-border rounded p-3 text-xs space-y-1.5">
                {analysis.pain_point && <p><span className="text-accent">Pain point: </span>{analysis.pain_point}</p>}
                {analysis.opportunity && <p><span className="text-accent">Opportunity: </span>{analysis.opportunity}</p>}
                {analysis.reasoning && <p><span className="text-text-dim">Reasoning: </span>{analysis.reasoning}</p>}
                {analysis.score && (
                  <p className="pt-1 border-t border-border text-text-dim">
                    Score: <span className="text-accent font-bold">{analysis.score}</span>/10
                  </p>
                )}
              </div>
            </div>
          )}

          {lead.response_text && (
            <div>
              <p className="label">Generated Response</p>
              <div className="bg-bg border border-border rounded p-3 text-xs text-text-dim leading-relaxed whitespace-pre-wrap">
                {lead.edited_text || lead.response_text}
              </div>
              {lead.response_status && (
                <p className="text-xs text-muted mt-1">Status: {lead.response_status}</p>
              )}
              {lead.reddit_comment_id && (
                <p className="text-xs text-green-500 mt-1">Posted · Comment ID: {lead.reddit_comment_id}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <select
            className="input text-xs"
            value={lead.status}
            onChange={async e => {
              await api.updateLead(lead.id, { status: e.target.value });
              onUpdate?.();
            }}
          >
            {STATUS_OPTIONS.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [filters, setFilters] = useState({ status: '', campaign_id: '', limit: 50, offset: 0 });

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [leadsData, campaignData] = await Promise.all([
        api.getLeads(params),
        api.getCampaigns(),
      ]);
      setLeads(leadsData.leads);
      setTotal(leadsData.total);
      setCampaigns(campaignData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(key) {
    return e => setFilters(f => ({ ...f, [key]: e.target.value, offset: 0 }));
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-text">Leads</h1>
          <p className="text-xs text-text-dim mt-0.5">{total} total leads found</p>
        </div>

        <div className="flex items-center gap-2">
          <select className="input w-auto text-xs" value={filters.campaign_id} onChange={setFilter('campaign_id')}>
            <option value="">All campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto text-xs" value={filters.status} onChange={setFilter('status')}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button onClick={load} className="btn-ghost text-xs">⟳</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-text-dim text-xs">Loading leads...</div>
        ) : (
          <LeadTable leads={leads} onSelect={setSelected} />
        )}
      </div>

      {total > filters.limit && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            Showing {Math.min(filters.offset + 1, total)}–{Math.min(filters.offset + filters.limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
              disabled={filters.offset === 0}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, offset: f.offset + f.limit }))}
              disabled={filters.offset + filters.limit >= total}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
