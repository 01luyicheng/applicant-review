import { useState, useMemo, useEffect, useId, useRef, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewConfig, FilterState } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  config: ViewConfig;
  applicants: { raw: Record<string, string> }[];
  onClear: () => void;
  onExport: () => void;
  onConfigUpload: (file: File) => void;
  exportDisabled?: boolean;
}

export default function FilterBar({ filters, onChange, config, applicants, onClear, onExport, onConfigUpload, exportDisabled }: FilterBarProps) {
  const { t } = useTranslation();
  const listFields = useMemo(() => config.listFields.filter(f => f.visibleInList), [config.listFields]);
  const [expanded, setExpanded] = useState(false);
  const displayFields = expanded ? listFields : listFields.slice(0, 4);
  const hasFilters = filters.search || filters.status || Object.values(filters.custom).some(v => v);
  const uploadId = useId();
  const searchId = useId();
  const statusFilterId = useId();
  const filterBaseId = useId();

  // 300ms debounce for search input - use refs to keep deps stable (only inputSearch)
  const [inputSearch, setInputSearch] = useState(filters.search);
  const onChangeRef = useRef(onChange);
  const filtersRef = useRef(filters);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    setInputSearch(filters.search);
  }, [filters.search]);
  useEffect(() => {
    if (inputSearch === filtersRef.current.search) return;
    const tmr = setTimeout(() => {
      onChangeRef.current({ ...filtersRef.current, search: inputSearch });
    }, 300);
    return () => clearTimeout(tmr);
  }, [inputSearch]);

  // Phase1.5：对高频重算的去重使用 useDeferredValue + Map 缓存
  // - deferredApplicants 将 10k+ 行的去重计算标记为可中断低优先级，避免阻塞输入 INP
  // - useMemo + Map 缓存：仅当 deferredApplicants 引用或 listFields 变化时重算；相较每次过滤重算 20万次去重显著降低 CPU
  const deferredApplicants = useDeferredValue(applicants);
  const uniqueValuesMap = useMemo(() => {
    const map = new Map<string, { values: string[]; truncated: boolean; total: number }>();
    // 单次遍历优化：对每个 field 用 Set 收集，避免 applicants.map 产生中间数组
    listFields.forEach(field => {
      const set = new Set<string>();
      for (const a of deferredApplicants) {
        const v = a.raw[field.key];
        if (v) set.add(v);
        // 早期截断提示：超过 1000 唯一值后仍需统计 total，但 values 仅保留 100 作展示
        // 为保证 total 准确，不在此处 break；超大数据可考虑采样（此处保留全量以保证过滤完整）
      }
      const sorted = Array.from(set).sort();
      const total = sorted.length;
      const truncated = total > 100;
      const sliced = truncated ? sorted.slice(0, 100) : sorted;
      map.set(field.key, { values: sliced, truncated, total });
    });
    return map;
  }, [deferredApplicants, listFields]);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end mb-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor={searchId} className="block text-xs text-gray-500 mb-1">{t('search.label')}</label>
          <input
            id={searchId}
            type="text"
            placeholder={t('search.placeholder')}
            value={inputSearch}
            onChange={e => setInputSearch(e.target.value)}
            aria-label={t('search.placeholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
          />
        </div>

        <div className="min-w-[140px]">
          <label htmlFor={statusFilterId} className="block text-xs text-gray-500 mb-1">{t('filter.status')}</label>
          <select
            id={statusFilterId}
            value={filters.status}
            onChange={e => onChange({ ...filters, status: e.target.value })}
            aria-label={t('filter.status')}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
          >
            <option value="">{t('filter.all')}</option>
            {config.statusValues.map(sv => (
              <option key={sv.value} value={sv.value}>{sv.label}</option>
            ))}
          </select>
        </div>

        {displayFields.map(field => {
          const entry = uniqueValuesMap.get(field.key) || { values: [], truncated: false, total: 0 };
          const values = entry.values;
          const fieldId = `${filterBaseId}-${field.key}`;
          return (
            <div key={field.key} className="min-w-[140px]">
              <label htmlFor={fieldId} className="block text-xs text-gray-500 mb-1" title={entry.truncated ? t('filter.truncatedTitle', { total: entry.total }) : undefined}>
                {field.label}{entry.truncated ? t('filter.truncatedSuffix', { total: entry.total }) : ''}
              </label>
              <select
                id={fieldId}
                value={filters.custom[field.key] || ''}
                onChange={e => onChange({
                  ...filters,
                  custom: { ...filters.custom, [field.key]: e.target.value }
                })}
                aria-label={`${field.label}`}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
              >
                <option value="">{t('filter.all')}</option>
                {values.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {entry.truncated && (
                <div className="text-[10px] text-amber-600 mt-0.5">{t('filter.truncated')}</div>
              )}
            </div>
          );
        })}
        {listFields.length > 4 && (
          <div className="flex items-end">
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded whitespace-nowrap"
            >
              {expanded ? t('filter.collapse') : t('filter.moreCount', { count: listFields.length - 4 })}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">{t('filter.config')}:</label>
          <input
            type="file"
            accept=".json"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onConfigUpload(file);
              e.currentTarget.value = '';
            }}
            className="text-sm text-gray-500 file:mr-2 file:px-2 file:py-1 file:border file:border-gray-300 file:rounded file:bg-gray-50 file:text-xs hover:file:bg-gray-100"
            style={{ display: 'none' }}
            id={uploadId}
          />
          <label htmlFor={uploadId} className="text-sm text-blue-600 hover:underline cursor-pointer">
            {t('filter.switchConfig')}
          </label>
          <span className="text-xs text-gray-400">{t('filter.current')}: {config.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={onClear} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded">
              {t('filter.clear')}
            </button>
          )}
          <button
            onClick={onExport}
            disabled={!!exportDisabled}
            aria-label={t('filter.export')}
            title={exportDisabled ? t('filter.exportDisabled') : t('filter.export')}
            className="px-3 py-2 text-sm text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('filter.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
