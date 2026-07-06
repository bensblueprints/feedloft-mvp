import React from 'react';
import { Star } from 'lucide-react';

function relativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

export default function ArticleList({ items, selectedId, onSelect, onLoadMore, hasMore }) {
  return (
    <div className="w-96 shrink-0 border-r border-surface-border overflow-y-auto h-full">
      {items.map((item) => (
        <div
          key={item.id}
          id={`item-row-${item.id}`}
          onClick={() => onSelect(item)}
          className={`px-4 py-3 border-b border-surface-border/60 cursor-pointer ${
            selectedId === item.id ? 'bg-amber-500/10' : 'hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="truncate">{item.feed_title}</span>
            <span className="flex items-center gap-1 shrink-0">
              {item.starred ? <Star size={12} className="fill-amber-400 text-amber-400" /> : null}
              {relativeTime(item.published_at)}
            </span>
          </div>
          <div className={`text-sm leading-snug ${item.read ? 'text-gray-400' : 'text-gray-100 font-semibold'}`}>
            {item.title}
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="p-6 text-sm text-gray-500 text-center">No articles here yet.</div>}
      {hasMore && (
        <button onClick={onLoadMore} className="w-full py-3 text-xs text-gray-500 hover:text-gray-300">
          Load more
        </button>
      )}
    </div>
  );
}
