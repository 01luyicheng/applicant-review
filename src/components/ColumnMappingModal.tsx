import { useEffect, useId, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewConfig } from '../types';

export interface ColumnMappingModalProps {
  open: boolean;
  headers: string[];
  config: ViewConfig;
  onConfirm: (mapping: Record<string, string>, createNewFields: string[], newFieldLabels?: Record<string, string>) => void;
  onClose: () => void;
}

/** {t('mapping.autoMatchComment')} */
export function autoMatchHeader(header: string, configKeys: string[]): string {
  const h = header.trim();
  if (!h) return '';
  const exact = configKeys.find(k => k === h);
  if (exact) return exact;
  const lower = h.toLowerCase();
  const contains = configKeys.find(k => {
    const kl = k.toLowerCase();
    return kl.includes(lower) || lower.includes(kl);
  });
  return contains || '';
}

function buildInitialMapping(headers: string[], configKeys: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  headers.forEach(h => {
    m[h] = autoMatchHeader(h, configKeys);
  });
  return m;
}

export default function ColumnMappingModal({ open, headers, config, onConfirm, onClose }: ColumnMappingModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const configKeys = useMemo(() => {
    const keys = new Set<string>();
    config.listFields.forEach(f => keys.add(f.key));
    config.detailGroups.forEach(g => g.fields.forEach(f => keys.add(f.key)));
    if (config.idField) keys.add(config.idField);
    if (config.nameField) keys.add(config.nameField);
    if (config.statusField) keys.add(config.statusField);
    return Array.from(keys);
  }, [config]);

  const [mapping, setMapping] = useState<Record<string, string>>(() => buildInitialMapping(headers, configKeys));
  const [createNewFields, setCreateNewFields] = useState<string[]>([]);
  const [newFieldLabels, setNewFieldLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const init = buildInitialMapping(headers, configKeys);
      setMapping(init);
      const unmatched = headers.filter(h => !init[h]);
      const labels: Record<string, string> = {};
      unmatched.forEach(h => { labels[h] = h; });
      headers.forEach(h => { if (!labels[h]) labels[h] = h; });
      setCreateNewFields([]);
      setNewFieldLabels(labels);
      setStep(1);
    }
  }, [open, headers, configKeys]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const unmatchedHeaders = headers.filter(h => !mapping[h]);
  const diffNew = createNewFields.map(k => ({ key: k, label: newFieldLabels[k] || k }));
  const diffMapped = Object.entries(mapping).filter(([h, v]) => v && !createNewFields.includes(h) && v !== h);
  const diffIgnored = headers.filter(h => !mapping[h] && !createNewFields.includes(h));

  const configKeyOptions = configKeys;

  const toggleCreateNew = (header: string) => {
    setCreateNewFields(prev => {
      const has = prev.includes(header);
      if (has) return prev.filter(x => x !== header);
      return [...prev, header];
    });
  };

  const handleConfirm = () => {
    const finalMapping: Record<string, string> = { ...mapping };
    createNewFields.forEach(h => {
      finalMapping[h] = h;
    });
    onConfirm(finalMapping, createNewFields, newFieldLabels);
  };

  const canNext1 = true;
  const canNext2 = true;
  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} className="bg-white rounded w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 id={titleId} className="font-medium text-gray-900">{t('mapping.title')}</h3>
          <button onClick={onClose} aria-label={t('mapping.closeAria')} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">×</button>
        </div>
        <p id={descId} className="sr-only">{t('mapping.ruleHint')}</p>

        <div className="px-4 pt-3">
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
            <div className="bg-gray-900 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${step === 1 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('mapping.step1')}</span>
            <span className="text-gray-300">→</span>
            <span className={`px-2 py-1 rounded ${step === 2 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('mapping.step2')}</span>
            <span className="text-gray-300">→</span>
            <span className={`px-2 py-1 rounded ${step === 3 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('mapping.step3')}</span>
            <span className="ml-auto text-gray-400">{t('mapping.columnsInfo', { headers: headers.length, keys: configKeys.length })}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {step === 1 && (
            <div>
              <p className="text-xs text-gray-500 mb-3">{t('mapping.ruleHint')}</p>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.excelHeader')}</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.targetKey')}</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(h => {
                      const val = mapping[h] || '';
                      const isMatched = !!val;
                      return (
                        <tr key={h} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={h}>{h}</td>
                          <td className="px-3 py-2">
                            <select
                              value={val}
                              onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                            >
                              <option value="">{t('mapping.unmappedOption')}</option>
                              {configKeyOptions.map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {isMatched ? <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">{t('mapping.matched')}</span> : <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{t('mapping.unmatched')}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {headers.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-400">{t('mapping.noHeader')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-gray-400">{t('mapping.tip')}</div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs text-gray-500 mb-3">{t('mapping.newFieldHint')}</p>
              {unmatchedHeaders.length === 0 && createNewFields.length === 0 ? (
                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded">{t('mapping.allMatched')}</div>
              ) : null}
              <div className="space-y-2">
                {headers.map(h => {
                  const isUnmatched = !mapping[h];
                  const isChecked = createNewFields.includes(h);
                  const shouldShow = isUnmatched || isChecked || unmatchedHeaders.includes(h);
                  if (!shouldShow && !isChecked) {
                    return (
                      <div key={h} className="flex items-center gap-2 text-xs px-3 py-2 border border-gray-100 rounded bg-gray-50/50">
                        <span className="flex-1 truncate" title={h}>{h} <span className="text-gray-400">→ {mapping[h]}</span></span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleCreateNew(h)} />
                          <span>{t('mapping.convertToNew')}</span>
                        </label>
                      </div>
                    );
                  }
                  return (
                    <div key={h} className="flex items-center gap-2 text-sm border border-gray-200 rounded px-3 py-2 bg-white">
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleCreateNew(h)} />
                        <span className="truncate font-mono text-xs" title={h}>{h}</span>
                        {!isUnmatched && <span className="text-xs text-gray-400">→ {mapping[h]}</span>}
                      </label>
                      <input
                        value={newFieldLabels[h] || ''}
                        onChange={e => setNewFieldLabels(prev => ({ ...prev, [h]: e.target.value }))}
                        placeholder={t('mapping.placeholderLabel')}
                        disabled={!isChecked}
                        className="w-36 px-2 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100 disabled:text-gray-400"
                        title={t('mapping.newFieldLabelTitle')}
                      />
                      <span className={`text-xs px-2 py-0.5 rounded border ${isChecked ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{isChecked ? t('mapping.new') : t('mapping.ignore')}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-gray-500">{t('mapping.selectedNew')}{createNewFields.length ? createNewFields.map(k => `${k}(${newFieldLabels[k] || k})`).join('、') : t('builder.none')}</div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs text-gray-500 mb-3">{t('mapping.confirmHint')}</p>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.excelHeader')}</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.targetKeyLabel')}</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left">{t('mapping.type')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(h => {
                      const isNew = createNewFields.includes(h);
                      const mapped = mapping[h] || '';
                      let typeKey: string;
                      let target: string;
                      let rowClass = '';
                      if (isNew) {
                        typeKey = t('mapping.added');
                        target = `${h}（${newFieldLabels[h] || h}）`;
                        rowClass = 'bg-blue-50/50';
                      } else if (mapped && mapped !== h) {
                        typeKey = t('mapping.mapped');
                        target = mapped;
                        rowClass = 'bg-amber-50/30';
                      } else if (mapped === h) {
                        typeKey = t('mapping.direct');
                        target = h;
                        rowClass = '';
                      } else {
                        typeKey = t('mapping.ignoredType');
                        target = '—';
                        rowClass = 'bg-gray-50';
                      }
                      const typeColor = typeKey === t('mapping.added') ? 'bg-blue-100 text-blue-700 border-blue-200' : typeKey === t('mapping.mapped') ? 'bg-amber-100 text-amber-700 border-amber-200' : typeKey === t('mapping.direct') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200';
                      return (
                        <tr key={h} className={`border-b border-gray-100 last:border-0 ${rowClass}`}>
                          <td className="px-3 py-1.5 font-mono text-xs truncate max-w-[180px]" title={h}>{h}</td>
                          <td className="px-3 py-1.5 text-xs truncate max-w-[200px]" title={target}>{target}</td>
                          <td className="px-3 py-1.5 text-xs">
                            <span className={`px-2 py-0.5 rounded text-xs border ${typeColor}`}>{typeKey}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-blue-50 border border-blue-200 text-blue-700">{t('mapping.addedSummary', { count: diffNew.length, labels: (diffNew.slice(0,3).map(f=>f.label).join('、') || t('builder.none')) + (diffNew.length>3 ? t('builder.ellipsis') : '') })}</div>
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-700">{t('mapping.mappedSummary', { count: diffMapped.length, labels: (diffMapped.slice(0,3).map(([h,k])=>`${h}→${k}`).join('、') || t('builder.none')) + (diffMapped.length>3 ? t('builder.ellipsis') : '') })}</div>
                <div className="p-2 rounded bg-gray-50 border border-gray-200 text-gray-600">{t('mapping.ignoredSummary', { count: diffIgnored.length, labels: (diffIgnored.slice(0,3).join('、') || t('builder.none')) + (diffIgnored.length>3 ? t('builder.ellipsis') : '') })}</div>
              </div>
              <div className="mt-3 p-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded">
                {t('mapping.applyHint', { count: diffNew.length })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between gap-2">
          <div className="flex gap-2">
            {step !== 1 && <button onClick={() => setStep(s => (s === 3 ? 2 : 1) as 1|2|3)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-white">{t('mapping.prev')}</button>}
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-white">{t('mapping.cancel')}</button>
          </div>
          <div className="flex gap-2">
            {step === 1 && <button onClick={() => setStep(2)} disabled={!canNext1} className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">{t('mapping.next')}</button>}
            {step === 2 && <button onClick={() => setStep(3)} disabled={!canNext2} className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">{t('mapping.previewDiff')}</button>}
            {step === 3 && <button onClick={handleConfirm} className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700">{t('mapping.confirmApply')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
