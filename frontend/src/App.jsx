import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AgentStatusBar from './components/AgentStatusBar';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Queue from './pages/Queue';
import Leads from './pages/Leads';
import Settings from './pages/Settings';
import { api } from './api';

export const AgentContext = React.createContext(null);
export const ToastContext = React.createContext(null);

export default function App() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await api.getAgentStatus();
        setAgentStatus(status);
        setDemoMode(status.demo_mode);
      } catch (err) {
        // Backend not available yet
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  return (
    <BrowserRouter>
      <AgentContext.Provider value={{ agentStatus, refresh: () => {} }}>
        <ToastContext.Provider value={{ addToast }}>
          <div className="flex h-screen overflow-hidden bg-bg">
            <Sidebar demoMode={demoMode} />

            <div className="flex-1 flex flex-col overflow-hidden">
              {demoMode && (
                <div className="bg-accent/10 border-b border-accent/30 px-4 py-2 flex items-center gap-2">
                  <span className="badge-demo">DEMO MODE</span>
                  <span className="text-xs text-text-dim">
                    Reddit credentials not configured — showing mock data.
                    <a href="/settings" className="text-accent ml-1 hover:underline">Add credentials →</a>
                  </span>
                </div>
              )}

              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/queue" element={<Queue />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>

              <AgentStatusBar status={agentStatus} />
            </div>
          </div>

          {/* Toast notifications */}
          <div className="fixed bottom-16 right-4 flex flex-col gap-2 z-50">
            {toasts.map(toast => (
              <div
                key={toast.id}
                className={`px-4 py-3 rounded border text-xs font-mono animate-slide-in max-w-sm ${
                  toast.type === 'error' ? 'bg-red-900/80 border-red-700 text-red-200' :
                  toast.type === 'success' ? 'bg-green-900/80 border-green-700 text-green-200' :
                  'bg-surface border-border text-text'
                }`}
              >
                {toast.message}
              </div>
            ))}
          </div>
        </ToastContext.Provider>
      </AgentContext.Provider>
    </BrowserRouter>
  );
}
