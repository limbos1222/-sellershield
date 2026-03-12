import React, { useEffect, useState, useContext } from 'react';
import CampaignCard from '../components/CampaignCard';
import { api } from '../api';
import { ToastContext } from '../App';

const STYLE_OPTIONS = [
  { value: 'helpful_expert', label: 'Helpful Expert' },
  { value: 'casual_founder', label: 'Casual Founder' },
  { value: 'subtle_mention', label: 'Subtle Mention' },
];

function CampaignForm({ onSave, onCancel }) {
  const { addToast } = useContext(ToastContext);
  const [form, setForm] = useState({
    name: '',
    product_name: '',
    product_description: '',
    icp: '',
    pain_points: '',
    subreddits: 'SaaS,entrepreneur,startups',
    keywords: 'looking for,recommend,anyone use,help with,struggling with',
    response_style: 'helpful_expert',
    warmup_mode: false,
  });
  const [saving, setSaving] = useState(false);

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        subreddits: form.subreddits.split(',').map(s => s.trim()).filter(Boolean),
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.createCampaign(data);
      addToast('Campaign created!', 'success');
      onSave?.();
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card max-w-2xl">
      <h2 className="font-serif text-lg text-text mb-4">New Campaign</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Campaign Name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Q1 SaaS Outreach" required />
          </div>
          <div>
            <label className="label">Product Name</label>
            <input className="input" value={form.product_name} onChange={set('product_name')} placeholder="e.g. LeadLoop" required />
          </div>
        </div>

        <div>
          <label className="label">Product Description</label>
          <textarea
            className="input resize-none h-20"
            value={form.product_description}
            onChange={set('product_description')}
            placeholder="What does your product do? Be specific — Claude uses this to score and engage with leads."
            required
          />
        </div>

        <div>
          <label className="label">Ideal Customer Profile (ICP)</label>
          <input
            className="input"
            value={form.icp}
            onChange={set('icp')}
            placeholder="e.g. B2B SaaS founders with 5-50 employees who do manual outreach"
            required
          />
        </div>

        <div>
          <label className="label">Pain Points Solved</label>
          <textarea
            className="input resize-none h-16"
            value={form.pain_points}
            onChange={set('pain_points')}
            placeholder="e.g. Manual Reddit prospecting is time-consuming, hard to scale, and risky without the right approach"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Subreddits (comma-separated)</label>
            <input
              className="input"
              value={form.subreddits}
              onChange={set('subreddits')}
              placeholder="SaaS,entrepreneur,startups"
              required
            />
            <p className="text-xs text-muted mt-1">Without r/ prefix</p>
          </div>
          <div>
            <label className="label">Intent Keywords (comma-separated)</label>
            <input
              className="input"
              value={form.keywords}
              onChange={set('keywords')}
              placeholder="recommend,looking for,help with"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Response Style</label>
            <select className="input" value={form.response_style} onChange={set('response_style')}>
              {STYLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="warmup"
              checked={form.warmup_mode}
              onChange={set('warmup_mode')}
              className="w-4 h-4 accent-accent"
            />
            <div>
              <label htmlFor="warmup" className="text-xs text-text cursor-pointer">Warmup Mode</label>
              <p className="text-xs text-muted">No product mentions for 14 days</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-text">Campaigns</h1>
          <p className="text-xs text-text-dim mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? '× Cancel' : '+ New Campaign'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <CampaignForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-text-dim text-xs">Loading campaigns...</div>
      ) : campaigns.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">◈</p>
          <p className="text-sm text-text-dim mb-2">No campaigns yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-2">
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onUpdate={load}
              onDelete={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
