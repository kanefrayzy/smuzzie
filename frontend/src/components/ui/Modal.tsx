'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, maxWidth = 'max-w-4xl' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Close button — fixed at top-right, always visible */}
          <motion.button
            onClick={onClose}
            className="fixed top-4 right-4 z-[110] text-white/80 hover:text-white transition-all duration-200 flex items-center gap-2 px-4 py-2.5 bg-black/70 backdrop-blur-md border border-white/10 hover:border-accent-red/40 hover:bg-accent-red/20"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-[11px] font-mono uppercase tracking-wider">Close</span>
            <kbd className="px-2 py-0.5 bg-white/10 text-[10px] font-mono border border-white/10">ESC</kbd>
          </motion.button>

          {/* Scrollable content area */}
          <div className="flex items-center justify-center min-h-full p-4">
            <motion.div
              className={`relative z-10 w-full ${maxWidth} my-auto`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
