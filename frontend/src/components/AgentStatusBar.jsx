import React from 'react';

export default function AgentStatusBar({ status }) {
  const isRunning = status?.running;

  return (
    <div className="h-9 bg-surface border-t border-border px-4 flex items-center gap-6 flex-shrink-0 relative overflow-hidden">
      {isRunning && (
        <div
          className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"
          style={{
            animation: 'slideRight 2s linear infinite',
          }}
        />
      )}

      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
        <span className={`text-xs ${isRunning ? 'text-accent' : 'text-muted'}`}>
          {isRunning
            ? `Scanning${status?.currentCampaignId ? '...' : ''}`
            : 'IDLE'
          }
        </span>
      </div>

      {status?.lastRunAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="text-text-dim">Last run:</span>
          <span>{new Date(status.lastRunAt).toLocaleTimeString()}</span>
        </div>
      )}

      {status?.lastRunStats && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="text-green-500">{status.lastRunStats.leadsFound}</span>
          <span className="text-text-dim">leads found ·</span>
          <span className="text-blue-400">{status.lastRunStats.responsesGenerated}</span>
          <span className="text-text-dim">responses</span>
        </div>
      )}

      <div className="ml-auto text-xs text-muted">
        {isRunning ? '⟳ running' : 'next in ~30m'}
      </div>

      <style>{`
        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
