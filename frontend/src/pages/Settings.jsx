import React, { useEffect, useState, useContext } from 'react';
import { api } from '../api';
import { ToastContext } from '../App';

export default function Settings() {
  const { addToast } = useContext(ToastContext);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState({});
  const [autoPostConfirmed, setAutoPostConfirmed] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setForm({
        anthropic_api_key: '',
        reddit_client_id: data.reddit_client_id || '',
        reddit_client_secret: '',
        reddit_username: data.reddit_username || '',
        reddit_password: '',
        max_posts_per_day: data.max_posts_per_day || '10',
        auto_posting_enabled: data.auto_posting_enabled === true || data.auto_posting_enabled === 'true',
        blacklist_users: Array.isArray(data.blacklist_users) ? data.blacklist_users.join(', ') : '',
        blacklist_subreddits: Array.isArray(data.blacklist_subreddits) ? data.blacklist_subreddits.join(', ') : '',
        signature: data.signature || '',
      });
    } catch (err) {
      addToast(`Failed to load settings: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  function set(key) {
    return e => setForm(f => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        blacklist_users: form.blacklist_users.split(',').map(s => s.trim()).filter(Boolean),
        blacklist_subreddits: form.blacklist_subreddits.split(',').map(s => s.trim()).filter(Boolean),
        auto_posting_enabled: String(form.auto_posting_enabled),
      };

      // Remove empty sensitive fields so we don't overwrite with empty
      if (!payload.anthropic_api_key) delete payload.anthropic_api_key;
      if (!payload.reddit_client_secret) delete payload.reddit_client_secret;
      if (!payload.reddit_password) delete payload.reddit_password;

      await api.updateSettings(payload);
      addToast('Settings saved', 'success');
      await load();
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestReddit() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testReddit();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-xs text-text-dim">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-text">Settings</h1>
        <p className="text-xs text-text-dim mt-0.5">API keys, posting limits, and preferences</p>
      </div>

      {settings.demo_mode && (
        <div className="card border-accent/30 bg-accent/5 mb-6">
          <div className="flex items-start gap-3">
            <span className="badge-demo flex-shrink-0 mt-0.5">DEMO MODE</span>
            <div>
              <p className="text-xs text-text">Reddit credentials not configured</p>
              <p className="text-xs text-text-dim mt-1">
                Add your Reddit credentials below to enable real lead discovery and posting.
                The app works without them — you'll see mock data to explore the UI.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Anthropic */}
        <section className="card">
          <h2 className="font-serif text-base text-text mb-4">Claude AI</h2>
          <div>
            <label className="label">Anthropic API Key</label>
            <input
              type="password"
              className="input"
              value={form.anthropic_api_key}
              onChange={set('anthropic_api_key')}
              placeholder={settings.anthropic_api_key_set ? '••••••••  (leave blank to keep current)' : 'sk-ant-...'}
              autoComplete="off"
            />
            {settings.anthropic_api_key_set && (
              <p className="text-xs text-green-500 mt-1">✓ API key is configured</p>
            )}
            <p className="text-xs text-muted mt-1">
              Get your key at <span className="text-text-dim">console.anthropic.com</span>. Uses claude-sonnet-4-20250514.
            </p>
          </div>
        </section>

        {/* Reddit */}
        <section className="card">
          <h2 className="font-serif text-base text-text mb-4">Reddit Account</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client ID</label>
                <input className="input" value={form.reddit_client_id} onChange={set('reddit_client_id')} placeholder="From reddit.com/prefs/apps" />
              </div>
              <div>
                <label className="label">Client Secret</label>
                <input
                  type="password"
                  className="input"
                  value={form.reddit_client_secret}
                  onChange={set('reddit_client_secret')}
                  placeholder={settings.reddit_client_secret_set ? '•••••• (keep current)' : 'From reddit.com/prefs/apps'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username</label>
                <input className="input" value={form.reddit_username} onChange={set('reddit_username')} placeholder="your_reddit_username" />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={form.reddit_password}
                  onChange={set('reddit_password')}
                  placeholder={settings.reddit_password_set ? '•••••• (keep current)' : 'your password'}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestReddit}
                disabled={testing}
                className="btn-ghost text-xs"
              >
                {testing ? 'Testing...' : '⚡ Test Reddit Connection'}
              </button>

              {testResult && (
                <div className={`mt-2 text-xs p-2 rounded border ${
                  testResult.success
                    ? 'bg-green-900/20 border-green-900/50 text-green-400'
                    : 'bg-red-900/20 border-red-900/50 text-red-400'
                }`}>
                  {testResult.success
                    ? `✓ Connected as u/${testResult.username} · ${testResult.karma} karma · ${testResult.account_age_days} days old`
                    : `✗ ${testResult.error}`
                  }
                </div>
              )}
            </div>

            <div className="text-xs text-muted bg-bg border border-border rounded p-3">
              <p className="text-text-dim mb-1 font-medium">Create a Reddit app:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Go to reddit.com/prefs/apps</li>
                <li>Click "create another app..."</li>
                <li>Type: <span className="text-text">script</span>, Redirect URI: <span className="text-text">http://localhost:3001</span></li>
                <li>Copy the Client ID (under app name) and Client Secret</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Limits & Safety */}
        <section className="card">
          <h2 className="font-serif text-base text-text mb-4">Limits & Safety</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Max posts per day</label>
              <input
                type="number"
                className="input w-32"
                value={form.max_posts_per_day}
                onChange={set('max_posts_per_day')}
                min="1"
                max="50"
              />
              <p className="text-xs text-muted mt-1">Across all campaigns. Keep low to avoid spam detection.</p>
            </div>

            <div>
              <label className="label">Signature / CTA (optional)</label>
              <input
                className="input"
                value={form.signature}
                onChange={set('signature')}
                placeholder="e.g. — Built LeadLoop, happy to chat"
              />
              <p className="text-xs text-muted mt-1">Appended naturally when product is mentioned</p>
            </div>

            <div>
              <label className="label">Blacklisted usernames (comma-separated)</label>
              <input className="input" value={form.blacklist_users} onChange={set('blacklist_users')} placeholder="spammer123, troll456" />
            </div>

            <div>
              <label className="label">Blacklisted subreddits (comma-separated)</label>
              <input className="input" value={form.blacklist_subreddits} onChange={set('blacklist_subreddits')} placeholder="subreddit1, subreddit2" />
            </div>

            <div className="border border-yellow-900/50 bg-yellow-900/10 rounded p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autopost"
                  checked={form.auto_posting_enabled}
                  onChange={e => {
                    if (e.target.checked && !autoPostConfirmed) {
                      if (!confirm('Enable auto-posting? Responses will be posted to Reddit WITHOUT manual review. Are you sure you understand the risks?')) {
                        return;
                      }
                      setAutoPostConfirmed(true);
                    }
                    set('auto_posting_enabled')(e);
                  }}
                  className="mt-0.5 w-4 h-4 accent-yellow-500"
                />
                <div>
                  <label htmlFor="autopost" className="text-xs text-yellow-400 cursor-pointer font-medium">
                    Enable auto-posting (bypass review queue)
                  </label>
                  <p className="text-xs text-muted mt-0.5">
                    Approved responses will post immediately without human review.
                    Disabled by default for safety.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button type="button" onClick={load} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
