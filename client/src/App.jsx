import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search as SearchIcon, LogOut, CheckCheck } from 'lucide-react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Sidebar from './components/Sidebar.jsx';
import ArticleList from './components/ArticleList.jsx';
import ArticlePane from './components/ArticlePane.jsx';
import ShortcutOverlay from './components/ShortcutOverlay.jsx';
import FeedSettingsModal from './components/FeedSettingsModal.jsx';

export default function App() {
  const [authed, setAuthed] = useState(null); // null = unknown/loading
  const [folders, setFolders] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [selection, setSelection] = useState({ type: 'all' });
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [shortcutOverlay, setShortcutOverlay] = useState(false);
  const [settingsFeed, setSettingsFeed] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef(null);
  const gPressedRef = useRef(false);

  useEffect(() => {
    api
      .session()
      .then((s) => setAuthed(!!s.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  const loadFoldersAndFeeds = useCallback(async () => {
    const [f, fe] = await Promise.all([api.folders(), api.feeds()]);
    setFolders(f);
    setFeeds(fe);
  }, []);

  useEffect(() => {
    if (authed) loadFoldersAndFeeds();
  }, [authed, loadFoldersAndFeeds]);

  const loadItems = useCallback(async (sel, opts = {}) => {
    const params = { limit: 50 };
    if (sel.type === 'feed') params.feed = sel.id;
    if (sel.type === 'folder') params.folder = sel.id;
    if (sel.type === 'starred') params.starred = 1;
    if (opts.before) params.before = opts.before;
    const rows = await api.items(params);
    setItems((prev) => (opts.before ? [...prev, ...rows] : rows));
    if (!opts.before) {
      setSelectedItem(null);
      setSelectedIndex(-1);
    }
  }, []);

  useEffect(() => {
    if (authed && !searchMode) loadItems(selection);
  }, [authed, selection, searchMode, loadItems]);

  async function runSearch(q) {
    if (!q.trim()) return;
    const results = await api.search(q, selection.type === 'feed' ? selection.id : undefined);
    setItems(results);
    setSearchMode(true);
    setSelectedItem(null);
    setSelectedIndex(-1);
  }

  function exitSearch() {
    setSearchMode(false);
    setSearchQuery('');
    loadItems(selection);
  }

  async function selectItemAt(index) {
    if (index < 0 || index >= items.length) return;
    setSelectedIndex(index);
    const item = items[index];
    setSelectedItem(item);
    if (!item.read) {
      const updated = await api.updateItem(item.id, { read: 1 });
      applyItemUpdate(updated);
      refreshUnreadCounts();
    }
  }

  function applyItemUpdate(updated) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setSelectedItem((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  }

  async function refreshUnreadCounts() {
    const fe = await api.feeds();
    setFeeds(fe);
  }

  async function toggleReadCurrent() {
    if (!selectedItem) return;
    const updated = await api.updateItem(selectedItem.id, { read: selectedItem.read ? 0 : 1 });
    applyItemUpdate(updated);
    refreshUnreadCounts();
  }

  async function toggleStarCurrent() {
    if (!selectedItem) return;
    const updated = await api.updateItem(selectedItem.id, { starred: selectedItem.starred ? 0 : 1 });
    applyItemUpdate(updated);
  }

  async function markAllRead() {
    const body = {};
    if (selection.type === 'feed') body.feedId = selection.id;
    else if (selection.type === 'folder') body.folderId = selection.id;
    else body.all = true;
    await api.markRead(body);
    loadItems(selection);
    refreshUnreadCounts();
  }

  async function refreshCurrent() {
    setRefreshing(true);
    try {
      if (selection.type === 'feed') {
        await api.refreshFeed(selection.id);
      } else {
        await Promise.all(feeds.map((f) => api.refreshFeed(f.id)));
      }
      await loadItems(selection);
      await refreshUnreadCounts();
    } finally {
      setRefreshing(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current && searchInputRef.current.focus();
        return;
      }
      if (typing) return;

      if (e.key === '?') {
        setShortcutOverlay((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setShortcutOverlay(false);
        return;
      }
      if (e.key === 'j') {
        selectItemAt(Math.min(selectedIndex + 1, items.length - 1));
        return;
      }
      if (e.key === 'k') {
        selectItemAt(Math.max(selectedIndex - 1, 0));
        return;
      }
      if (e.key === 'n') {
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === 'p') {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'o' || e.key === 'Enter') {
        selectItemAt(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      if (e.key === 'm') {
        toggleReadCurrent();
        return;
      }
      if (e.key === 's') {
        toggleStarCurrent();
        return;
      }
      if (e.key === 'v') {
        if (selectedItem && selectedItem.url) window.open(selectedItem.url, '_blank');
        return;
      }
      if (e.key === 'r') {
        refreshCurrent();
        return;
      }
      if (e.key === 'A' && e.shiftKey) {
        markAllRead();
        return;
      }
      if (e.key === 'g') {
        if (gPressedRef.current) {
          selectItemAt(0);
          gPressedRef.current = false;
        } else {
          gPressedRef.current = true;
          setTimeout(() => (gPressedRef.current = false), 500);
        }
        return;
      }
      if (e.key === 'G') {
        selectItemAt(items.length - 1);
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (authed === null) return <div className="h-screen bg-surface" />;
  if (!authed) return <Login onLoggedIn={() => setAuthed(true)} />;

  return (
    <div className="h-screen w-screen flex flex-col bg-surface text-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border bg-surface-raised shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <SearchIcon size={15} className="text-gray-500" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch(searchQuery);
              if (e.key === 'Escape') exitSearch();
            }}
            placeholder="Search articles… (press /)"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-600"
          />
          {searchMode && (
            <button onClick={exitSearch} className="text-xs text-gray-500 hover:text-gray-300">
              clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            title="Mark all read (Shift+A)"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
          <button
            onClick={refreshCurrent}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            title="Refresh (r)"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShortcutOverlay(true)}
            className="text-xs text-gray-400 hover:text-gray-200"
            title="Shortcuts (?)"
          >
            ?
          </button>
          <button
            onClick={() => api.logout().then(() => setAuthed(false))}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar
          folders={folders}
          feeds={feeds}
          selection={selection}
          onSelect={(sel) => {
            setSearchMode(false);
            setSelection(sel);
          }}
          onFeedsChanged={loadFoldersAndFeeds}
          onOpenFeedSettings={setSettingsFeed}
        />
        <ArticleList
          items={items}
          selectedId={selectedItem ? selectedItem.id : null}
          onSelect={(item) => selectItemAt(items.findIndex((i) => i.id === item.id))}
          onLoadMore={() => loadItems(selection, { before: items[items.length - 1]?.id })}
          hasMore={items.length >= 50 && !searchMode}
        />
        <ArticlePane item={selectedItem} onChange={applyItemUpdate} />
      </div>

      <ShortcutOverlay open={shortcutOverlay} onClose={() => setShortcutOverlay(false)} />
      <FeedSettingsModal
        feed={settingsFeed}
        folders={folders}
        onClose={() => setSettingsFeed(null)}
        onSaved={(updated) => {
          setFeeds((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
          setSettingsFeed(null);
        }}
        onDeleted={(id) => {
          setFeeds((prev) => prev.filter((f) => f.id !== id));
          setSettingsFeed(null);
        }}
      />
    </div>
  );
}
