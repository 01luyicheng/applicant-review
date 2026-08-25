// SPDX-License-Identifier: MIT
import { useCallback, useEffect } from 'react';
import type { Applicant, ViewConfig } from '../types';
import {
  saveApplicants,
  debouncedSaveApplicants,
  flushPendingSave,
  clearApplicants,
  setupClearOnUnload,
} from '../utils/storage';

export interface UsePersistenceOptions {
  config?: ViewConfig;
  configRef?: React.MutableRefObject<ViewConfig>;
  getTitle?: () => string;
}

export interface UsePersistenceReturn {
  persist: (applicants: Applicant[], title?: string) => void;
  debounced: (applicants: Applicant[], title?: string) => void;
  queue: (applicants: Applicant[], title?: string) => void;
  flush: () => void;
  clear: () => void;
}

function resolveTitle(opts: UsePersistenceOptions): string {
  if (opts.getTitle) {
    try { return opts.getTitle(); } catch { /* fallback */ }
  }
  if (opts.configRef?.current?.title) return opts.configRef.current.title;
  if (opts.config?.title) return opts.config.title;
  return '';
}

/**
 * 抽离 saveApplicants / debouncedSave / flush + configTitle 联动
 * - 暴露 persist / queue(=debounced) / debounced / flush / clear
 * - 内部接管 beforeunload/visibilitychange flush + setupClearOnUnload，避免 App/useApplicants 重复注册
 * - configTitle 联动：未显式传 title 时取 configRef/config/getTitle 的当前 title
 */
export function usePersistence(options: UsePersistenceOptions = {}): UsePersistenceReturn {
  const getResolvedTitle = useCallback(() => resolveTitle(options), [options]);

  useEffect(() => {
    setupClearOnUnload();
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', flushPendingSave);
    const onVis = () => { if (document.hidden) flushPendingSave(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', flushPendingSave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const persist = useCallback((applicants: Applicant[], title?: string) => {
    const t = title ?? getResolvedTitle();
    saveApplicants(applicants, t, { maskSensitive: true });
  }, [getResolvedTitle]);

  const debounced = useCallback((applicants: Applicant[], title?: string) => {
    const t = title ?? getResolvedTitle();
    debouncedSaveApplicants(applicants, t, { maskSensitive: true });
  }, [getResolvedTitle]);

  const queue = debounced;

  const flush = useCallback(() => { flushPendingSave(); }, []);
  const clear = useCallback(() => { clearApplicants(); }, []);

  return { persist, debounced, queue, flush, clear };
}

export default usePersistence;
