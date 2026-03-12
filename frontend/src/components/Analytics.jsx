import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';

function StatCard({ label, value, sub, color = 'text-text' }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${color} animate-count-up`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded p-3 text-xs">
      <p className="text-text-dim mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [days]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([api.getAnalytics(), api.getCharts(days)]);
      setStats(s);
      setCharts(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-text-dim text-xs">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leads Found" value={stats?.leads_found} sub={`${stats?.leads_today || 0} today`} color="text-text" />
        <StatCard label="In Review" value={stats?.pending_review} sub="awaiting approval" color="text-blue-400" />
        <StatCard label="Posted" value={stats?.posted} sub="responses live" color="text-green-400" />
        <StatCard label="Converted" value={stats?.converted} sub="customers acquired" color="text-accent" />
      </div>

      {/* Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-base text-text">Lead Activity</h2>
          <div className="flex gap-1">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  days === d ? 'bg-accent text-white' : 'text-text-dim hover:text-text hover:bg-border'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={charts?.series || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8888a0', fontSize: 11 }}
              tickFormatter={d => d.slice(5)}
              axisLine={{ stroke: '#1e1e2e' }}
            />
            <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} axisLine={{ stroke: '#1e1e2e' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#8888a0' }} />
            <Line type="monotone" dataKey="leads" stroke="#ff5500" strokeWidth={2} dot={false} name="Leads Found" />
            <Line type="monotone" dataKey="posts" stroke="#22c55e" strokeWidth={2} dot={false} name="Posted" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top subreddits */}
        <div className="card">
          <h3 className="font-serif text-sm text-text mb-3">Top Subreddits</h3>
          {stats?.top_subreddits?.length ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs text-muted pb-2">Subreddit</th>
                  <th className="text-right text-xs text-muted pb-2">Leads</th>
                  <th className="text-right text-xs text-muted pb-2">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_subreddits.map(row => (
                  <tr key={row.subreddit} className="border-t border-border">
                    <td className="py-2 text-xs text-accent">r/{row.subreddit}</td>
                    <td className="py-2 text-xs text-right text-text">{row.lead_count}</td>
                    <td className="py-2 text-xs text-right text-text-dim">{(row.avg_score || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted">No data yet</p>
          )}
        </div>

        {/* Funnel */}
        <div className="card">
          <h3 className="font-serif text-sm text-text mb-3">Conversion Funnel</h3>
          {stats?.funnel && (
            <div className="space-y-2">
              {[
                { label: 'Found', key: 'found', color: 'bg-text-dim' },
                { label: 'Reviewed', key: 'reviewed', color: 'bg-blue-500' },
                { label: 'Posted', key: 'posted', color: 'bg-green-500' },
                { label: 'Replied', key: 'replied', color: 'bg-purple-500' },
                { label: 'Converted', key: 'converted', color: 'bg-accent' },
              ].map(step => {
                const val = stats.funnel[step.key] || 0;
                const max = stats.funnel.found || 1;
                const pct = Math.round((val / max) * 100);
                return (
                  <div key={step.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-dim">{step.label}</span>
                      <span className="text-text tabular-nums">{val}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded overflow-hidden">
                      <div className={`h-full ${step.color} rounded`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
