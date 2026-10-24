'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

const LIMIT = 100;
const TRAIL_MS = 120;

/**
 * Undo/redo stack. `record(before)` is called with the state as it was before a change;
 * changes that follow each other closely (a drag, typing) merge into one step unless
 * `force` is set (discrete actions: add, delete, align).
 */
export function useUndo<T>(gapMs = 600) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastAt = useRef(0);
  // When a drag was released: changes right after it still belong to it (the editor may record
  // its last frame a moment later), anything after that is a new step
  const brokeAt = useRef(0);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const record = useCallback(
    (before: T, force = false) => {
      const now = performance.now();
      if (!force && brokeAt.current) {
        if (now - brokeAt.current < TRAIL_MS) return;
        brokeAt.current = 0;
        lastAt.current = 0;
      }
      if (force || now - lastAt.current > gapMs) {
        past.current.push(before);
        if (past.current.length > LIMIT) past.current.shift();
        future.current = [];
        bump();
      }
      // A forced step never swallows the next change
      lastAt.current = force ? 0 : now;
    },
    [gapMs],
  );

  const undo = useCallback((current: T): T | undefined => {
    const prev = past.current.pop();
    if (prev === undefined) return undefined;
    future.current.push(current);
    lastAt.current = 0;
    bump();
    return prev;
  }, []);

  const redo = useCallback((current: T): T | undefined => {
    const next = future.current.pop();
    if (next === undefined) return undefined;
    past.current.push(current);
    lastAt.current = 0;
    bump();
    return next;
  }, []);

  /** End of a gesture (pointer released): the next change starts a new step. */
  const breakStep = useCallback(() => {
    brokeAt.current = performance.now();
  }, []);

  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    lastAt.current = 0;
    bump();
  }, []);

  return { record, undo, redo, clear, breakStep, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

/** Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Text fields keep their own undo. */
export function useUndoKeys(undo: () => void, redo: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, enabled]);
}
