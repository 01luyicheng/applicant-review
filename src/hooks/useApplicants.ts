import { useState, useEffect, useCallback, useRef } from 'react';
import { Applicant, ViewConfig } from '../types';
import { parseFile } from '../utils/fileParser';
import { saveConfig, getStatusLabel } from '../config';
import { loadApplicants } from '../utils/storage';
import { reportError } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { useHistory, HistoryEntry } from './useHistory';
import { usePersistence } from './usePersistence';

export type { HistoryEntry };

export interface UseApplicantsOptions {
  config: ViewConfig;
  configRef: React.MutableRefObject<ViewConfig>;
  configLoading: boolean;
  configLoadingRef: React.MutableRefObject<boolean>;
  pendingFileRef: React.MutableRefObject<File | null>;
  queuePendingFile: (file: File) => void;
  setConfig: React.Dispatch<React.SetStateAction<ViewConfig>>;
  setConfigError: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export interface UseApplicantsReturn {
  applicants: Applicant[];
  setApplicants: React.Dispatch<React.SetStateAction<Applicant[]>>;
  selectedApplicant: Applicant | null;
  setSelectedApplicant: React.Dispatch<React.SetStateAction<Applicant | null>>;
  headers: string[];
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>;
  loading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  history: HistoryEntry[];
  toast: { message: string; visible: boolean } | null;
  showToast: (message: string) => void;
  showColumnMapping: boolean;
  pendingHeaders: string[];
  pendingApplicants: Applicant[] | null;
  handleFileLoad: (file: File) => Promise<void>;
  handleStatusChange: (id: string, status: string) => void;
  handleUndo: () => void;
  handleMappingConfirm: (mapping: Record<string, string>, createNewFields: string[], newFieldLabels?: Record<string, string>) => void;
  handleMappingClose: () => void;
  persistApplicants: (next: Applicant[], title?: string) => void;
  clear: () => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
}

/**
 * 管理 applicants / selectedApplicant / headers / history / persist
 * 内部使用 configRef 避免闭包过期，与 storage 封装联动
 */
export function useApplicants(options: UseApplicantsOptions): UseApplicantsReturn {
  const { config, configRef, configLoading, configLoadingRef, pendingFileRef, queuePendingFile, setConfig, setConfigError, setCurrentPage } = options;
  const { t } = useTranslation();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const { history, pushHistory, undo, setHistory, clearHistory } = useHistory();

  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingApplicants, setPendingApplicants] = useState<Applicant[] | null>(null);
  const previousConfigRefForMapping = useRef<ViewConfig | null>(null);

  // toast helper with t() support for history; timer ref cleanup avoids window error in tests
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const { persist: persistStore, queue: queueStore } = usePersistence({ config, configRef });

  // Persist helper with quota handling (immediate for file load)
  const persistApplicants = useCallback(
    (next: Applicant[], title: string = configRef.current.title) => {
      try {
        persistStore(next, title);
      } catch (e) {
        setError((e as Error).message);
        reportError(e, { configTitle: title, source: 'persistApplicants' });
      }
    },
    [persistStore, configRef]
  );

  const handleFileLoad = useCallback(
    async (file: File) => {
      if (configLoadingRef.current) {
        setError(t('error.configLoadingQueued'));
        queuePendingFile(file);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const currentConfig = configRef.current;
        const data = await parseFile(file, currentConfig);
        if (data.length > 0) {
          const hdrs = Object.keys(data[0].raw);
          const cfgKeys = new Set([...currentConfig.listFields.map(f => f.key), ...currentConfig.detailGroups.flatMap(g => g.fields.map(f => f.key)), currentConfig.idField, currentConfig.nameField, currentConfig.statusField]);
          const missing = hdrs.filter(h => !cfgKeys.has(h)).length;
          const ratio = hdrs.length > 0 ? missing / hdrs.length : 0;
          const threshold = currentConfig.mappingThreshold ?? 0.3;
          if (hdrs.length > 0 && ratio > threshold) {
            setPendingHeaders(hdrs);
            setPendingApplicants(data);
            previousConfigRefForMapping.current = structuredClone(currentConfig);
            setShowColumnMapping(true);
            setLoading(false);
            return;
          }
          setApplicants(data);
          setSelectedApplicant(null);
          setCurrentPage(1);
          clearHistory();
          setHeaders(hdrs);
          // 使用可配置阈值，避免 30% 过敏；mappingThreshold 默认 0.3
          const threshold2 = currentConfig.mappingThreshold ?? 0.3;
          if (hdrs.length > 0 && missing / hdrs.length > threshold2) {
            setConfigError(t('error.newStructureMapping', { total: hdrs.length, missing }));
          } else if (hdrs.length > 0 && missing / hdrs.length > 0.5) {
            setConfigError(t('error.newStructureBuilder', { total: hdrs.length, missing }));
          }
          persistApplicants(data, currentConfig.title);
        } else {
          setApplicants(data);
          setSelectedApplicant(null);
          setCurrentPage(1);
          clearHistory();
          setHeaders([]);
          persistApplicants(data, currentConfig.title);
        }
      } catch (err) {
        setError(t('error.parseFailed'));
        reportError(err, { source: 'handleFileLoad', configTitle: configRef.current.title });
      } finally {
        setLoading(false);
      }
    },
    [persistApplicants, configRef, configLoadingRef, queuePendingFile, setCurrentPage, setConfigError, clearHistory, t]
  );

  // 恢复 applicants：config 加载完成后从 storage 恢复，并消费 pendingFile 队列
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (configLoading) return;
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      try {
        const restored = loadApplicants(config.title);
        if (restored && restored.length > 0) {
          setApplicants(restored);
          setCurrentPage(1);
        }
      } catch (e) {
        reportError(e, { source: 'restoreApplicants', configTitle: config.title });
      }
    }
    if (pendingFileRef.current) {
      const f = pendingFileRef.current;
      pendingFileRef.current = null;
      setTimeout(() => handleFileLoad(f), 0);
    }
  }, [configLoading, config.title, handleFileLoad, pendingFileRef, setCurrentPage]);

  const handleMappingConfirm = useCallback((mapping: Record<string, string>, createNewFields: string[], newFieldLabels: Record<string, string> = {}) => {
    const currentConfig = configRef.current;
    const pending = pendingApplicants;
    const hdrs = pendingHeaders.length ? pendingHeaders : (pending ? (pending[0] ? Object.keys(pending[0].raw) : []) : []);
    if (!pending || pending.length === 0) {
      setShowColumnMapping(false);
      return;
    }
    const nextConfig: ViewConfig = structuredClone(currentConfig);
    if (nextConfig.detailGroups.length === 0) {
      nextConfig.detailGroups = [{ label: t('detail.newGroup'), fields: [] }];
    }
    const existingKeys = new Set([...nextConfig.listFields.map(f => f.key), ...nextConfig.detailGroups.flatMap(g => g.fields.map(f => f.key))]);
    createNewFields.forEach(h => {
      const label = (newFieldLabels[h] || h).trim() || h;
      if (!existingKeys.has(h)) {
        nextConfig.listFields.push({ key: h, label, visibleInList: true });
        let targetGroup = nextConfig.detailGroups.find(g => g.label === t('detail.newGroup')) || nextConfig.detailGroups[0];
        if (!targetGroup) {
          targetGroup = { label: t('detail.newGroup'), fields: [] };
          nextConfig.detailGroups.push(targetGroup);
        }
        if (!targetGroup.fields.some(f => f.key === h)) {
          targetGroup.fields.push({ key: h, label });
        }
        existingKeys.add(h);
      } else {
        const lf = nextConfig.listFields.find(f => f.key === h);
        if (lf && label !== h) lf.label = label;
        nextConfig.detailGroups.forEach(g => {
          const ff = g.fields.find(f => f.key === h);
          if (ff && label !== h) ff.label = label;
        });
      }
    });
    setConfig(nextConfig);
    saveConfig(nextConfig);
    const transformed: Applicant[] = pending.map(app => {
      const raw: Record<string, string> = { ...app.raw };
      hdrs.forEach(h => {
        const target = mapping[h];
        if (!target) return;
        if (createNewFields.includes(h)) return;
        if (target !== h) {
          const val = app.raw[h];
          if (val !== undefined) raw[target] = val;
        }
      });
      const newId = String(raw[nextConfig.idField] || app.id);
      return { id: newId, raw };
    });
    const finalHeaders = Array.from(new Set([...hdrs, ...Object.keys(transformed[0]?.raw || {})]));
    setHeaders(finalHeaders);
    setApplicants(transformed);
    setSelectedApplicant(null);
    setCurrentPage(1);
    clearHistory();
    persistApplicants(transformed, nextConfig.title);
    setShowColumnMapping(false);
    setPendingApplicants(null);
    setPendingHeaders([]);
    setConfigError(null);
    showToast(t('toast.mappingApplied', { added: createNewFields.length, mapped: Object.entries(mapping).filter(([h,k])=>k && !createNewFields.includes(h) && k!==h).length }));
  }, [pendingApplicants, pendingHeaders, persistApplicants, showToast, configRef, setConfig, setConfigError, setCurrentPage, clearHistory, t]);

  const handleMappingClose = useCallback(() => {
    if (pendingApplicants) {
      const hdrs = pendingHeaders.length ? pendingHeaders : Object.keys(pendingApplicants[0]?.raw || {});
      setHeaders(hdrs);
      setApplicants(pendingApplicants);
      setSelectedApplicant(null);
      setCurrentPage(1);
      clearHistory();
      persistApplicants(pendingApplicants, configRef.current.title);
      setConfigError(t('error.mappingCancelled'));
    }
    setShowColumnMapping(false);
    setPendingApplicants(null);
    setPendingHeaders([]);
  }, [pendingApplicants, pendingHeaders, persistApplicants, configRef, setConfigError, setCurrentPage, clearHistory, t]);

  const handleStatusChange = useCallback((id: string, status: string) => {
    let prevStatusForHistory: string | null = null;
    let didChange = false;
    setApplicants(prev => {
      const target = prev.find(a => a.id === id);
      const prevStatus = target?.raw[configRef.current.statusField] || '';
      prevStatusForHistory = prevStatus;
      if (prevStatus === status) return prev;
      didChange = true;
      const next = prev.map(a =>
        a.id === id ? { ...a, raw: { ...a.raw, [configRef.current.statusField]: status } } : a
      );
      try {
        queueStore(next, configRef.current.title);
      } catch (e) {
        setError((e as Error).message);
        reportError(e, { source: 'handleStatusChange', configTitle: configRef.current.title });
      }
      return next;
    });
    if (prevStatusForHistory !== null && !didChange) return;
    if (prevStatusForHistory !== null && didChange) {
      const prevStatus = prevStatusForHistory;
      pushHistory({ id, prevStatus, nextStatus: status });
      const label = getStatusLabel(status, configRef.current) || status || t('status.pending');
      showToast(t('toast.statusChanged', { label }));
      setSelectedApplicant(prevSel => {
        if (prevSel && prevSel.id === id) {
          return { ...prevSel, raw: { ...prevSel.raw, [configRef.current.statusField]: status } };
        }
        return prevSel;
      });
    }
  }, [pushHistory, showToast, configRef, queueStore, t]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = undo();
    if (!last) return;
    setApplicants(curr => {
      const next = curr.map(a =>
        a.id === last.id ? { ...a, raw: { ...a.raw, [configRef.current.statusField]: last.prevStatus } } : a
      );
      try {
        queueStore(next, configRef.current.title);
      } catch (e) {
        setError((e as Error).message);
        reportError(e, { source: 'handleUndo', configTitle: configRef.current.title });
      }
      return next;
    });
    setSelectedApplicant(s => {
      if (s && s.id === last.id) {
        return { ...s, raw: { ...s.raw, [configRef.current.statusField]: last.prevStatus } };
      }
      return s;
    });
    const label = getStatusLabel(last.prevStatus, configRef.current) || last.prevStatus || t('status.pending');
    showToast(t('toast.undone', { label }));
  }, [history, undo, showToast, configRef, t]);

  // Ctrl+Z undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  // keep selectedApplicant synced with applicants updates
  useEffect(() => {
    if (selectedApplicant) {
      const latest = applicants.find(a => a.id === selectedApplicant.id);
      if (latest && latest.raw[config.statusField] !== selectedApplicant.raw[config.statusField]) {
        setSelectedApplicant(latest);
      }
    }
  }, [applicants, config.statusField, selectedApplicant]);

  const clear = useCallback(() => {
    clearHistory();
    setApplicants([]);
    setSelectedApplicant(null);
    setHeaders([]);
    setPendingApplicants(null);
    setPendingHeaders([]);
    setShowColumnMapping(false);
  }, [clearHistory]);

  return {
    applicants,
    setApplicants,
    selectedApplicant,
    setSelectedApplicant,
    headers,
    setHeaders,
    loading,
    error,
    setError,
    history,
    toast,
    showToast,
    showColumnMapping,
    pendingHeaders,
    pendingApplicants,
    handleFileLoad,
    handleStatusChange,
    handleUndo,
    handleMappingConfirm,
    handleMappingClose,
    persistApplicants,
    clear,
    setHistory,
  };
}

export default useApplicants;
