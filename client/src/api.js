const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let error = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) error = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(error);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  login: (password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  session: () => request('/auth/session'),

  folders: () => request('/folders'),
  createFolder: (name) => request('/folders', { method: 'POST', body: JSON.stringify({ name }) }),
  updateFolder: (id, data) => request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),

  feeds: () => request('/feeds'),
  addFeed: (url, folderId) => request('/feeds', { method: 'POST', body: JSON.stringify({ url, folderId }) }),
  updateFeed: (id, data) => request(`/feeds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeed: (id) => request(`/feeds/${id}`, { method: 'DELETE' }),
  refreshFeed: (id) => request(`/feeds/${id}/refresh`, { method: 'POST' }),

  items: (params) => request(`/items?${new URLSearchParams(params).toString()}`),
  updateItem: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  markRead: (data) => request('/items/mark-read', { method: 'POST', body: JSON.stringify(data) }),
  fulltext: (id) => request(`/items/${id}/fulltext`, { method: 'POST' }),

  search: (q, feed) => request(`/search?${new URLSearchParams({ q, ...(feed ? { feed } : {}) }).toString()}`),

  importOpml: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/opml/import', { method: 'POST', body: fd });
  },
  exportOpmlUrl: () => `${BASE}/opml/export`,

  status: () => request('/status'),
};
