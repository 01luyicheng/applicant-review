// SPDX-License-Identifier: MIT
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Applicant } from './types';
import { saveConfig } from './config';
import { useKeyboardShortcuts } from './utils/shortcuts';
import { useTranslation } from 'react-i18next';
import { getLocale, setLocale, Locale } from './i18n';
import StatsBar from './components/StatsBar';
import FilterBar from './components/FilterBar';
import ApplicantRow from './components/ApplicantRow';
import DetailModal from './components/DetailModal';
import FileUploader from './components/FileUploader';
import ConfigBuilder from './components/ConfigBuilder';
import ColumnMappingModal from './components/ColumnMappingModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useConfig } from './hooks/useConfig';
import { useFilters } from './hooks/useFilters';
import { useApplicants } from './hooks/useApplicants';
import { useHistory } from './hooks/useHistory';
import { useExport } from './hooks/useExport';
import { useGallery } from './hooks/useGallery';
import { usePersistence } from './hooks/usePersistence';

function App() {
  const { config, configLoading, configError, setConfig, setConfigError, setConfigLoading, configRef, configLoadingRef, pendingFileRef, queuePendingFile } = useConfig();
  const { t, i18n: i18nInstance } = useTranslation();
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());
  useEffect(() => {
    const handler = (e: Event) => setLocaleState((e as CustomEvent<Locale>).detail as Locale);
    const langHandler = (lng: string) => setLocaleState(lng as Locale);
    window.addEventListener('locale-change', handler as EventListener);
    i18nInstance.on('languageChanged', langHandler);
    return () => {
      window.removeEventListener('locale-change', handler as EventListener);
      i18nInstance.off('languageChanged', langHandler);
    };
  }, [i18nInstance]);

  const [showBuilder, setShowBuilder] = useState(false);
  const _historyHook = useHistory(); void _historyHook;
  const setCurrentPageRef = useRef<React.Dispatch<React.SetStateAction<number>>>(() => {});
  const wrapSetCurrentPage = useCallback((v: React.SetStateAction<number>) => setCurrentPageRef.current(v), []);

  const {
    applicants, selectedApplicant, setSelectedApplicant, headers, loading, error, setError, history, toast, showToast,
    showColumnMapping, pendingHeaders, handleFileLoad, handleStatusChange, handleUndo, handleMappingConfirm, handleMappingClose, setApplicants,
  } = useApplicants({ config, configRef, configLoading, configLoadingRef, pendingFileRef, queuePendingFile, setConfig, setConfigError, setCurrentPage: wrapSetCurrentPage });

  const { filters, setFilters, currentPage, setCurrentPage, pageSize, setPageSize, filteredApplicants, paginatedApplicants, totalPages, filteredIndexMap, clearFilters, pageStart, pageEnd } = useFilters(applicants, config);

  useEffect(() => { setCurrentPageRef.current = setCurrentPage; }, [setCurrentPage]);

  const { clear } = usePersistence({ config, configRef });
  const { handleConfigLoad, handleLoadExample, handleClearCache: galleryClear, GALLERY_OPTIONS } = useGallery({
    setConfig, setConfigError, setConfigLoading, setApplicants, setSelectedApplicant, setCurrentPage, showToast,
  });
  const handleClearCache = useCallback(() => {
    const ok = galleryClear();
    if (ok) { setError(null); showToast(t('toast.cleared')); }
  }, [galleryClear, setError, showToast, t]);

  const prevConfigTitleRef = useRef<string>(config.title);
  useEffect(() => {
    if (prevConfigTitleRef.current !== config.title && applicants.length > 0) {
      setConfigError(t('error.configUpdated', { from: prevConfigTitleRef.current, to: config.title }));
    }
    prevConfigTitleRef.current = config.title;
  }, [config.title, applicants.length, setConfigError, t]);

  const handleRowClick = useCallback((applicant: Applicant) => { setSelectedApplicant(applicant); }, [setSelectedApplicant]);
  const handleDetailStatusChange = useCallback((status: string) => {
    if (selectedApplicant) handleStatusChange(selectedApplicant.id, status);
  }, [selectedApplicant, handleStatusChange]);
  const { exportCSV } = useExport(filteredApplicants, config);

  const handleSelectById = useCallback((id: string | null) => {
    if (id === null) { setSelectedApplicant(null); return; }
    const idx = filteredIndexMap.get(id);
    const applicant = idx !== undefined ? filteredApplicants[idx] : undefined;
    if (applicant) {
      setSelectedApplicant(applicant);
      if (idx !== undefined && idx >= 0) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== currentPage) setCurrentPage(targetPage);
      }
    }
  }, [filteredApplicants, filteredIndexMap, pageSize, currentPage, setCurrentPage, setSelectedApplicant]);

  useEffect(() => {
    if (selectedApplicant) {
      const idx = filteredIndexMap.get(selectedApplicant.id);
      if (idx !== undefined && idx >= 0) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== currentPage) setCurrentPage(targetPage);
      }
    }
  }, [selectedApplicant, filteredIndexMap, pageSize, currentPage, setCurrentPage]);

  useKeyboardShortcuts(filteredApplicants, filteredIndexMap, selectedApplicant?.id || null, handleSelectById, handleStatusChange, config, handleRowClick);

  const visibleListFields = useMemo(() => config.listFields.filter(f => f.visibleInList), [config.listFields]);
  const headerListFields = useMemo(() => visibleListFields.filter(f => f.key !== config.nameField), [visibleListFields, config.nameField]);
  const nameLabel = useMemo(() => config.listFields.find(f => f.key === config.nameField)?.label || t('common.name'), [config.listFields, config.nameField, t]);
  const headerFileRef = useRef<HTMLInputElement>(null);
  const handleHeaderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFileLoad(file); e.target.value = '';
  };
  const handleBuilderSave = useCallback((next: typeof config) => {
    setConfig(next); saveConfig(next); try { clear(); } catch {}
    setApplicants([]); setSelectedApplicant(null); showToast(t('toast.configApplied'));
  }, [setConfig, setApplicants, setSelectedApplicant, showToast, clear, t]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-gray-900">{config.title}</h1>
              {configLoading && <span className="text-xs text-gray-500">{t('header.loadingConfig')}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-300 rounded overflow-hidden" role="group" aria-label={t('header.switchLanguage')}>
                <button onClick={() => setLocale('zh')} aria-pressed={locale === 'zh'} aria-label={t('header.switchToZh')} className={`px-2 py-1.5 text-xs font-medium ${locale === 'zh' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('header.langZh')}</button>
                <button onClick={() => setLocale('en')} aria-pressed={locale === 'en'} aria-label="Switch to English" className={`px-2 py-1.5 text-xs font-medium border-l border-gray-300 ${locale === 'en' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('header.langEn')}</button>
              </div>
              <label htmlFor="gallery-select" className="sr-only">{t('header.gallery')}</label>
              <select id="gallery-select" defaultValue="" onChange={e => { const path = e.target.value; if (path) { handleLoadExample(path); e.target.value = ''; } }} disabled={configLoading} className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50" title={t('header.galleryHint')}>
                <option value="">{t('header.gallery')}</option>
                {GALLERY_OPTIONS.map(opt => (<option key={opt.value} value={opt.path}>{t(opt.labelKey)} - {t(opt.descKey)}</option>))}
              </select>
              <button onClick={() => setShowBuilder(true)} className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">{t('header.builder')}</button>
              <input ref={headerFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleHeaderFileChange} className="hidden" disabled={loading || configLoading} />
              <button onClick={() => headerFileRef.current?.click()} disabled={loading || configLoading} className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('header.upload')}</button>
              {applicants.length > 0 && (<button onClick={handleClearCache} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded bg-white hover:bg-gray-50" title={t('header.clearCache')}>{t('header.clearCache')}</button>)}
            </div>
          </div>
        </div>
      </header>

      <ErrorBoundary>
        <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error && (<div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>)}
        {configError && (<div className="mb-4 p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded">{configError}</div>)}
        {configLoading && (<div className="mb-4 p-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded">{t('table.configLoading')}</div>)}
        <StatsBar applicants={applicants} config={config} filteredCount={filteredApplicants.length} />
        <FilterBar filters={filters} onChange={setFilters} config={config} applicants={applicants} onClear={clearFilters} onExport={exportCSV} onConfigUpload={handleConfigLoad} exportDisabled={filteredApplicants.length === 0} />
        <div className="overflow-x-auto border rounded bg-white shadow-sm relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-gray-100 to-transparent opacity-60 hidden sm:block" aria-hidden="true" title={t('table.scrollHint')} />
          <table className="w-full text-left text-sm" role="grid" aria-label={t('table.applicantList')} aria-rowcount={filteredApplicants.length + 1} aria-colcount={headerListFields.length + 4}>
            <thead><tr className="bg-gray-50 border-b border-gray-200" role="row">
              <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase w-12" role="columnheader" title="#">#</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap sticky left-0 bg-gray-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.06)]" title={nameLabel} role="columnheader">{nameLabel}</th>
              {headerListFields.map(f => (<th key={f.key} className="px-3 py-2 text-xs font-medium text-gray-500 uppercase max-w-[150px] truncate" title={f.label} role="columnheader">{f.label}</th>))}
              <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap" role="columnheader" title={t('table.status')}>{t('table.status')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-36 sticky right-0 bg-gray-50 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]" role="columnheader" title={t('table.actions')}>{t('table.actions')}</th>
            </tr></thead>
            <tbody>
              {filteredApplicants.length === 0 ? (
                <tr><td colSpan={4 + headerListFields.length} className="px-3 py-8 text-center text-gray-500">
                  {applicants.length === 0 ? (<><FileUploader onLoad={handleFileLoad} loading={loading || configLoading} />{configLoading && <div className="mt-2 text-xs text-gray-400">{t('table.configLoading')}</div>}</>) : t('table.empty')}
                </td></tr>
              ) : paginatedApplicants.map((applicant, i) => {
                const globalIndex = (currentPage - 1) * pageSize + i;
                return (<ApplicantRow key={applicant.id} applicant={applicant} config={config} listFields={headerListFields} index={globalIndex} onRowClick={handleRowClick} onStatusChangeById={handleStatusChange} isSelected={selectedApplicant?.id === applicant.id} />);
              })}
            </tbody>
          </table>
        </div>
        {filteredApplicants.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
            <div className="text-gray-600">{t('pagination.show')} {pageStart}-{pageEnd} {t('pagination.total')} {filteredApplicants.length} <span className="ml-2">{t('pagination.page', { current: currentPage, total: totalPages })}</span></div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">{t('pagination.perPage')}</label>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900">
                <option value={50}>50</option><option value={100}>100</option>
              </select>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label={t('pagination.prev')} className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.prev')}</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} aria-label={t('pagination.page', { current: pageNum, total: totalPages })} aria-current={currentPage === pageNum ? 'page' : undefined} className={`px-2 py-1 rounded border ${currentPage === pageNum ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>{pageNum}</button>);
                })}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label={t('pagination.next')} className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.next')}</button>
            </div>
          </div>
        )}
      </main>
      <DetailModal applicant={selectedApplicant} config={config} onClose={() => setSelectedApplicant(null)} onStatusChange={handleDetailStatusChange} />
      {showBuilder && (<ConfigBuilder headers={headers.length ? headers : Array.from(new Set([...config.listFields.map(f => f.key), ...config.detailGroups.flatMap(g => g.fields.map(f => f.key))]))} config={config} onClose={() => setShowBuilder(false)} onSave={handleBuilderSave} />)}
      {showColumnMapping && (<ColumnMappingModal open={showColumnMapping} headers={pendingHeaders} config={config} onClose={handleMappingClose} onConfirm={handleMappingConfirm} />)}
      {toast?.visible && (
        <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 z-50 text-sm">
          <span>{toast.message}</span>
          {history.length > 0 && (<button onClick={handleUndo} className="px-2 py-1 bg-white text-gray-900 rounded text-xs hover:bg-gray-100">{t('toast.undo')}</button>)}
        </div>
      )}
      </ErrorBoundary>
    </div>
  );
}

export default App;
