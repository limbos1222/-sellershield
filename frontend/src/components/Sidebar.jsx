import React, { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AgentContext } from '../App';

const nav = [
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/campaigns', label: 'Campaigns', icon: '◈' },
  { path: '/queue', label: 'Review Queue', icon: '◉' },
  { path: '/leads', label: 'Leads', icon: '◎' },
  { path: '/settings', label: 'Settings', icon: '◌' },
];

export default function Sidebar({ demoMode }) {
  const { agentStatus } = useContext(AgentContext);
  const isRunning = agentStatus?.running;

  return (
    <aside className="w-60 bg-surface border-r border-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`relative w-2 h-2 rounded-full ${isRunning ? 'bg-accent' : 'bg-border'}`}>
            {isRunning && (
              <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-75" />
            )}
          </div>
          <span className="font-serif text-lg text-text tracking-tight">LeadLoop</span>
        </div>
        <p className="text-text-dim text-xs mt-1">Reddit Lead Engine</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {nav.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-xs mb-0.5 transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-dim hover:text-text hover:bg-border'
              }`
            }
          >
            <span className="text-sm leading-none">{item.icon}</span>
            <span className="font-mono">{item.label}</span>
            {item.path === '/queue' && agentStatus?.lastRunStats?.responsesGenerated > 0 && (
              <span className="ml-auto bg-accent text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                !
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Agent state indicator */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
          <span className="text-xs text-text-dim">
            {isRunning ? 'Agent scanning...' : 'Agent idle'}
          </span>
        </div>
        {agentStatus?.lastRunAt && (
          <p className="text-xs text-muted pl-3.5">
            Last: {new Date(agentStatus.lastRunAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Version */}
      <div className="px-4 py-2 border-t border-border">
        <p className="text-xs text-muted">v1.0.0 · LeadLoop</p>
      </div>
    </aside>
  );
}
