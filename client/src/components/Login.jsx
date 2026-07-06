import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Rss } from 'lucide-react';
import { api } from '../api.js';

export default function Login({ onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-surface">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={submit}
        className="bg-surface-raised border border-surface-border rounded-xl p-8 w-full max-w-sm shadow-xl"
      >
        <div className="flex items-center gap-2 mb-6">
          <Rss className="text-amber-400" size={28} />
          <h1 className="text-xl font-semibold tracking-tight">Feedloft</h1>
        </div>
        <label className="block text-sm text-gray-400 mb-2">Admin password</label>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-black/30 border border-surface-border px-3 py-2 outline-none focus:border-amber-400 mb-4"
        />
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-gray-500 mt-4">Self-hosted. No account, no telemetry — just your password.</p>
      </motion.form>
    </div>
  );
}
