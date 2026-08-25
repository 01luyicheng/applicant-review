import { useState, useCallback } from 'react';

export type HistoryEntry = { id: string; prevStatus: string; nextStatus: string };

export interface UseHistoryReturn {
  history: HistoryEntry[];
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  clearHistory: () => void;
}

/**
 * History stack for status changes, supports push + undo (Ctrl+Z).
 * Decoupled from applicants so useApplicants can compose it.
 */
export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => [...prev, entry]);
  }, []);

  const undo = useCallback((): HistoryEntry | null => {
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    return last;
  }, [history]);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { history, pushHistory, undo, setHistory, clearHistory };
}

export default useHistory;
