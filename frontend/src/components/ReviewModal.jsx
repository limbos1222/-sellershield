import React, { useState, useContext } from 'react';
import { api } from '../api';
import { ToastContext } from '../App';

export default function ReviewModal({ item, onClose, onAction }) {
  const { addToast } = useContext(ToastContext);
  const [editText, setEditText] = useState(item.edited_text || item.response_text);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const hasEdits = editText !== item.response_text;

  async function handleApprove() {
    setLoading(true);
    try {
      if (hasEdits) {
        await api.editResponse(item.id, editText);
      }
      const result = await api.approveResponse(item.id);
      addToast(
        result.demo_mode
          ? 'Approved (Demo mode — copy the text to post manually)'
          : `Posted to Reddit! Comment ID: ${result.comment_id}`,
        'success'
      );
      onAction?.('approve');
      onClose();
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      addToast('Please add a rejection reason to improve future responses', 'info');
      setShowRejectInput(true);
      return;
    }
    setLoading(true);
    try {
      await api.rejectResponse(item.id, rejectReason);
      addToast('Response rejected', 'info');
      onAction?.('reject');
      onClose();
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    try {
      await api.editResponse(item.id, editText);
      setEditing(false);
      addToast('Edit saved', 'success');
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  }

  const analysis = item.analysis ? (typeof item.analysis === 'string' ? JSON.parse(item.analysis) : item.analysis) : null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-accent text-xs">r/{item.subreddit}</span>
            <span className="text-muted text-xs">u/{item.author}</span>
            {item.relevance_score && (
              <span className={`score-pill ${item.relevance_score >= 9 ? 'score-high' : 'score-med'}`}>
                {item.relevance_score}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-lg leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 grid grid-cols-2 gap-5">
          {/* Left: Post */}
          <div>
            <p className="label mb-2">Reddit Post</p>
            <div className="bg-bg border border-border rounded p-3 mb-3">
              <h3 className="text-sm text-text font-medium mb-2 leading-snug">{item.post_title}</h3>
              <p className="text-xs text-text-dim leading-relaxed line-clamp-8">
                {item.post_content || '(no body text)'}
              </p>
              <a
                href={item.post_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline mt-2 inline-block"
              >
                View on Reddit →
              </a>
            </div>

            {/* Analysis */}
            {analysis && (
              <div>
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="text-xs text-text-dim hover:text-text flex items-center gap-1 mb-2"
                >
                  {showReasoning ? '▼' : '▶'} Claude's reasoning
                </button>
                {showReasoning && (
                  <div className="bg-bg border border-border rounded p-3 text-xs text-text-dim space-y-1.5">
                    {analysis.pain_point && (
                      <p><span className="text-accent">Pain point:</span> {analysis.pain_point}</p>
                    )}
                    {analysis.opportunity && (
                      <p><span className="text-accent">Opportunity:</span> {analysis.opportunity}</p>
                    )}
                    {analysis.reasoning && (
                      <p><span className="text-accent">Reasoning:</span> {analysis.reasoning}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label">Generated Response</p>
              <div className="flex items-center gap-2">
                {hasEdits && <span className="text-xs text-yellow-400">• edited</span>}
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-xs text-text-dim hover:text-text"
                >
                  {editing ? 'Cancel' : '✏ Edit'}
                </button>
              </div>
            </div>

            {editing ? (
              <div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="input resize-none h-52 text-xs leading-relaxed"
                  placeholder="Edit the response..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSaveEdit} className="btn-ghost text-xs">Save edit</button>
                  <button onClick={() => { setEditText(item.response_text); setEditing(false); }} className="text-xs text-muted hover:text-text">
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="bg-bg border border-border rounded p-3 text-xs text-text leading-relaxed min-h-[13rem] cursor-text whitespace-pre-wrap"
                onClick={() => setEditing(true)}
              >
                {editText}
              </div>
            )}

            {/* Reject reason input */}
            {showRejectInput && (
              <div className="mt-3">
                <label className="label">Why reject? (helps improve future responses)</label>
                <input
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="input text-xs"
                  placeholder="e.g. too promotional, wrong audience, bad tone..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRejectInput(!showRejectInput)}
              className="btn-danger"
              disabled={loading}
            >
              ✕ Reject
            </button>
            {showRejectInput && (
              <button
                onClick={handleReject}
                className="btn-danger"
                disabled={loading || !rejectReason.trim()}
              >
                Confirm reject
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-muted mr-2">
              {item.campaign_name && `Campaign: ${item.campaign_name}`}
            </p>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-700 hover:bg-green-600 text-white px-5 py-2 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : '✓'} Approve & Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
