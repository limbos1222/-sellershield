import React from 'react';

function ScorePill({ score }) {
  const cls = score >= 9 ? 'score-high' : score >= 7 ? 'score-med' : 'score-low';
  return <span className={cls}>{score}</span>;
}

function StatusBadge({ status }) {
  const map = {
    pending_review: 'badge-pending',
    posted: 'badge-posted',
    rejected: 'badge-rejected',
    replied: 'badge bg-purple-900/30 text-purple-400 border border-purple-900/50',
    converted: 'badge bg-green-900/50 text-green-300 border border-green-700',
  };
  return <span className={map[status] || 'badge bg-surface text-text-dim border border-border'}>{status?.replace('_', ' ')}</span>;
}

export default function LeadTable({ leads, onSelect }) {
  if (!leads?.length) {
    return (
      <div className="text-center py-16 text-text-dim">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">No leads found yet.</p>
        <p className="text-xs mt-1">Run an agent on a campaign to start finding leads.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="table-header">Score</th>
            <th className="table-header">Subreddit</th>
            <th className="table-header">Post</th>
            <th className="table-header">Author</th>
            <th className="table-header">Status</th>
            <th className="table-header">Found</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr
              key={lead.id}
              className="table-row cursor-pointer"
              onClick={() => onSelect?.(lead)}
            >
              <td className="table-cell">
                <ScorePill score={lead.relevance_score} />
              </td>
              <td className="table-cell">
                <span className="text-accent text-xs">r/{lead.subreddit}</span>
              </td>
              <td className="table-cell max-w-xs">
                <a
                  href={lead.post_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-text hover:text-accent transition-colors line-clamp-1 text-xs"
                  title={lead.post_title}
                >
                  {lead.post_title}
                </a>
              </td>
              <td className="table-cell text-text-dim">u/{lead.author}</td>
              <td className="table-cell">
                <StatusBadge status={lead.status} />
              </td>
              <td className="table-cell text-muted whitespace-nowrap">
                {formatTime(lead.found_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
