import React, { useRef, useState } from 'react';
import { Rss, Star, Inbox, Plus, Settings, Upload, Download, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '../api.js';

export default function Sidebar({ folders, feeds, selection, onSelect, onFeedsChanged, onOpenFeedSettings }) {
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const fileRef = useRef(null);

  const unfiled = feeds.filter((f) => !f.folder_id);
  const totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
  const totalStarred = feeds.length; // starred is a virtual filter, computed server-side on demand

  async function submitAdd(e) {
    e.preventDefault();
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await api.addFeed(addUrl.trim(), null);
      setAddUrl('');
      onFeedsChanged();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await api.importOpml(file);
      onFeedsChanged();
    } catch (err) {
      alert(`OPML import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  }

  function toggleFolder(id) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  return (
    <div className="w-72 shrink-0 bg-surface-raised border-r border-surface-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Rss className="text-amber-400" size={20} />
          <span className="font-semibold tracking-tight">Feedloft</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((s) => !s)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-gray-200"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-8 z-20 bg-surface border border-surface-border rounded-lg shadow-xl p-2 w-48">
              <button
                onClick={() => fileRef.current && fileRef.current.click()}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-sm"
              >
                <Upload size={14} /> Import OPML
              </button>
              <a
                href={api.exportOpmlUrl()}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-sm"
              >
                <Download size={14} /> Export OPML
              </a>
              <input ref={fileRef} type="file" accept=".opml,.xml" className="hidden" onChange={onImportFile} />
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submitAdd} className="px-3 py-2 border-b border-surface-border">
        <div className="flex gap-1">
          <input
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="Add feed URL…"
            className="flex-1 bg-black/30 border border-surface-border rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-amber-500 hover:bg-amber-400 text-black rounded px-2 disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
        {addError && <p className="text-red-400 text-xs mt-1">{addError}</p>}
      </form>

      <div className="flex-1 overflow-y-auto py-2">
        <SidebarRow
          icon={<Inbox size={15} />}
          label="All"
          count={totalUnread}
          active={selection.type === 'all'}
          onClick={() => onSelect({ type: 'all' })}
        />
        <SidebarRow
          icon={<Star size={15} />}
          label="Starred"
          active={selection.type === 'starred'}
          onClick={() => onSelect({ type: 'starred' })}
        />

        <div className="mt-3">
          {folders.map((folder) => {
            const folderFeeds = feeds.filter((f) => f.folder_id === folder.id);
            const folderUnread = folderFeeds.reduce((s, f) => s + (f.unreadCount || 0), 0);
            const isCollapsed = collapsed[folder.id];
            return (
              <div key={folder.id}>
                <div
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:text-gray-300"
                  onClick={() => toggleFolder(folder.id)}
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <Folder size={12} />
                  <span
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'folder', id: folder.id });
                    }}
                  >
                    {folder.name}
                  </span>
                  {folderUnread > 0 && <span className="text-gray-400 normal-case font-normal">{folderUnread}</span>}
                </div>
                {!isCollapsed &&
                  folderFeeds.map((feed) => (
                    <FeedRow
                      key={feed.id}
                      feed={feed}
                      active={selection.type === 'feed' && selection.id === feed.id}
                      onClick={() => onSelect({ type: 'feed', id: feed.id })}
                      onSettings={() => onOpenFeedSettings(feed)}
                    />
                  ))}
              </div>
            );
          })}

          {unfiled.length > 0 && (
            <div className="mt-2">
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Feeds</div>
              {unfiled.map((feed) => (
                <FeedRow
                  key={feed.id}
                  feed={feed}
                  active={selection.type === 'feed' && selection.id === feed.id}
                  onClick={() => onSelect({ type: 'feed', id: feed.id })}
                  onSettings={() => onOpenFeedSettings(feed)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarRow({ icon, label, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
        active ? 'bg-amber-500/10 text-amber-300' : 'text-gray-300 hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count > 0 && <span className="text-xs text-gray-400">{count}</span>}
    </div>
  );
}

function FeedRow({ feed, active, onClick, onSettings }) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-pointer text-sm ${
        active ? 'bg-amber-500/10 text-amber-300' : 'text-gray-300 hover:bg-white/5'
      } ${feed.error_count > 0 ? 'text-red-400' : ''}`}
    >
      <span className="flex-1 truncate">{feed.title || feed.url}</span>
      {feed.unreadCount > 0 && <span className="text-xs text-gray-400">{feed.unreadCount}</span>}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSettings();
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200"
      >
        <Settings size={12} />
      </button>
    </div>
  );
}
