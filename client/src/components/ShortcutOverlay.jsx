import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SHORTCUTS = [
  ['j / k', 'Next / previous article'],
  ['n / p', 'Move without opening'],
  ['o / Enter', 'Open article'],
  ['m', 'Toggle read/unread'],
  ['s', 'Star / unstar'],
  ['v', 'Open original in browser'],
  ['r', 'Refresh current feed'],
  ['gg / G', 'Jump to top / bottom'],
  ['/', 'Focus search'],
  ['Shift+A', 'Mark all read'],
  ['?', 'Toggle this overlay'],
];

export default function ShortcutOverlay({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
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
            <h2 className="text-lg font-semibold mb-4">Keyboard shortcuts</h2>
            <div className="space-y-2">
              {SHORTCUTS.map(([key, desc]) => (
                <div key={key} className="flex justify-between text-sm">
                  <kbd className="bg-black/40 px-2 py-0.5 rounded border border-surface-border font-mono text-amber-300">
                    {key}
                  </kbd>
                  <span className="text-gray-300">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
