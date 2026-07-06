import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { api } from '../api.js';

export default function ArticlePane({ item, onChange }) {
  const [loadingFulltext, setLoadingFulltext] = useState(false);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select an article to read it here.
      </div>
    );
  }

  async function toggleStar() {
    const updated = await api.updateItem(item.id, { starred: item.starred ? 0 : 1 });
    onChange(updated);
  }

  async function fetchFullText() {
    setLoadingFulltext(true);
    try {
      const { fulltextHtml } = await api.fulltext(item.id);
      onChange({ ...item, fulltext_html: fulltextHtml });
    } catch (err) {
      alert(`Full text fetch failed: ${err.message}`);
    } finally {
      setLoadingFulltext(false);
    }
  }

  const bodyHtml = item.fulltext_html || item.content_html || item.summary || '<p><em>No content.</em></p>';

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={toggleStar} className="p-2 rounded hover:bg-white/5" title="Star (s)">
              <Star size={18} className={item.starred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'} />
            </button>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-white/5" title="Open original (v)">
                <ExternalLink size={18} className="text-gray-400" />
              </a>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-6">
          {item.feed_title} {item.author ? `· ${item.author}` : ''} · {new Date(item.published_at).toLocaleString()}
        </div>

        {!item.fulltext_html && (
          <button
            onClick={fetchFullText}
            disabled={loadingFulltext}
            className="mb-6 inline-flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 border border-surface-border rounded-full px-3 py-1.5 text-gray-300 disabled:opacity-50"
          >
            {loadingFulltext ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {loadingFulltext ? 'Fetching…' : 'Fetch full text'}
          </button>
        )}

        <div className="article-body text-gray-200 text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </motion.div>
  );
}
