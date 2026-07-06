import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import { api } from '../api.js';

export default function FeedSettingsModal({ feed, folders, onClose, onSaved, onDeleted }) {
  const [title, setTitle] = useState(feed ? feed.title : '');
  const [folderId, setFolderId] = useState(feed ? feed.folder_id : null);
  const [pollMinutes, setPollMinutes] = useState(feed ? feed.poll_minutes || '' : '');
  const [fulltextAlways, setFulltextAlways] = useState(feed ? !!feed.fulltext_always : false);

  if (!feed) return null;

  async function save() {
    const updated = await api.updateFeed(feed.id, {
      title,
      folderId: folderId || null,
      pollMinutes: pollMinutes ? Number(pollMinutes) : null,
      fulltextAlways,
    });
    onSaved(updated);
  }

  async function remove() {
    if (!confirm(`Unsubscribe from "${feed.title}"?`)) return;
    await api.deleteFeed(feed.id);
    onDeleted(feed.id);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-raised border border-surface-border rounded-xl p-6 w-full max-w-md"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Feed settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <X size={18} />
            </button>
          </div>

          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mb-3 bg-black/30 border border-surface-border rounded px-3 py-2 text-sm outline-none focus:border-amber-400"
          />

          <label className="block text-xs text-gray-400 mb-1">Folder</label>
          <select
            value={folderId || ''}
            onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
            className="w-full mb-3 bg-black/30 border border-surface-border rounded px-3 py-2 text-sm outline-none focus:border-amber-400"
          >
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <label className="block text-xs text-gray-400 mb-1">Poll interval override (minutes)</label>
          <input
            value={pollMinutes}
            onChange={(e) => setPollMinutes(e.target.value)}
            placeholder="Default (15 min)"
            className="w-full mb-3 bg-black/30 border border-surface-border rounded px-3 py-2 text-sm outline-none focus:border-amber-400"
          />

          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={fulltextAlways} onChange={(e) => setFulltextAlways(e.target.checked)} />
            Always fetch full text for this feed
          </label>

          {feed.error_count > 0 && (
            <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {feed.error_count} consecutive errors. Last: {feed.last_error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={remove} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300">
              <Trash2 size={14} /> Unsubscribe
            </button>
            <button onClick={save} className="bg-amber-500 hover:bg-amber-400 text-black rounded px-4 py-1.5 text-sm font-medium">
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
