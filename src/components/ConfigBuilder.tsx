import { useState, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewConfig, StatusValue } from '../types';
import { getConfigValidationErrors } from '../config';

interface ConfigBuilderProps {
  headers: string[];
  config: ViewConfig;
  onSave: (config: ViewConfig) => void;
  onClose: () => void;
}

export default function ConfigBuilder({ headers, config, onSave, onClose }: ConfigBuilderProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ViewConfig>(() => structuredClone(config));
  const [error, setError] = useState<string | null>(null);
  const [diffPreview, setDiffPreview] = useState<string | null>(null);
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setDraft(structuredClone(config));
    setDiffPreview(null);
  }, [config]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const autoGenerate = () => {
    if (!headers.length) return;
    const beforeList = draft.listFields.length;
    const beforeGroups = draft.detailGroups.length;
    const listFields = headers.slice(0, 8).map(h => ({ key: h, label: h, visibleInList: true }));
    const remaining = headers.slice(8);
    const detailGroups = [
      { label: t('builder.defaultMainGroup'), fields: listFields.map(f => ({ key: f.key, label: f.label })) },
      ...(remaining.length ? [{ label: t('builder.defaultOtherGroup'), fields: remaining.map(h => ({ key: h, label: h, multiline: h.length > 20 })) }] : []),
    ];
    setDraft({
      title: draft.title || t('builder.defaultTitle'),
      idField: headers[0] || draft.idField,
      nameField: headers.find(h => h.includes('姓名') || h.includes('name')) || headers[0] || draft.nameField,
      listFields,
      detailGroups,
      statusField: headers.find(h => h.includes('审核') || h.includes('状态')) || draft.statusField,
      statusValues: draft.statusValues,
    });
    const afterList = listFields.length;
    const afterGroups = detailGroups.length;
    const addedKeys = listFields.filter(f => !draft.listFields.some(d => d.key === f.key)).map(f => f.key);
    const removedKeys = draft.listFields.filter(f => !listFields.some(n => n.key === f.key)).map(f => f.key);
    const addedStr = addedKeys.slice(0,3).join('、') || t('builder.none');
    const addedSuffix = addedKeys.length >3 ? t('builder.ellipsis') : '';
    const removedStr = removedKeys.slice(0,3).join('、') || t('builder.none');
    const removedSuffix = removedKeys.length >3 ? t('builder.ellipsis') : '';
    setDiffPreview(
      t('builder.generated', {
        beforeList,
        afterList,
        added: `${addedStr}${addedSuffix}`,
        removed: `${removedStr}${removedSuffix}`,
        beforeGroups,
        afterGroups,
      })
    );
  };

  const handleSave = () => {
    const errors = getConfigValidationErrors(draft);
    if (errors.length) {
      setError(errors.join('；'));
      return;
    }
    setError(null);
    onSave(draft);
    onClose();
  };

  const toggleListField = (key: string) => {
    setDraft(prev => {
      const exists = prev.listFields.find(f => f.key === key);
      if (exists) {
        return { ...prev, listFields: prev.listFields.filter(f => f.key !== key) };
      }
      return { ...prev, listFields: [...prev.listFields, { key, label: key, visibleInList: true }] };
    });
  };

  const updateListFieldLabel = (key: string, label: string) => {
    setDraft(prev => ({
      ...prev,
      listFields: prev.listFields.map(f => f.key === key ? { ...f, label } : f),
      detailGroups: prev.detailGroups.map(g => ({ ...g, fields: g.fields.map(f => f.key === key ? { ...f, label } : f) })),
    }));
  };

  const moveListField = (index: number, dir: number) => {
    setDraft(prev => {
      const arr = [...prev.listFields];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return prev;
      const [item] = arr.splice(index, 1);
      arr.splice(target, 0, item);
      return { ...prev, listFields: arr };
    });
  };

  const updateStatusValues = (index: number, field: keyof StatusValue, value: string) => {
    setDraft(prev => {
      const arr = [...prev.statusValues];
      arr[index] = { ...arr[index], [field]: value } as StatusValue;
      return { ...prev, statusValues: arr };
    });
  };

  const addStatusValue = () => {
    setDraft(prev => ({ ...prev, statusValues: [...prev.statusValues, { value: t('builder.defaultStatusValue', { index: prev.statusValues.length }), label: t('builder.defaultStatusValue', { index: prev.statusValues.length }), color: 'gray' as const }] }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const addDetailGroup = () => {
    setDraft(prev => ({
      ...prev,
      detailGroups: [...prev.detailGroups, { label: t('builder.defaultGroupPrefix', { index: prev.detailGroups.length + 1 }), fields: [] }],
    }));
  };

  const removeDetailGroup = (idx: number) => {
    setDraft(prev => ({ ...prev, detailGroups: prev.detailGroups.filter((_, i) => i !== idx) }));
  };

  const updateGroupLabel = (idx: number, label: string) => {
    setDraft(prev => {
      const arr = [...prev.detailGroups];
      arr[idx] = { ...arr[idx], label };
      return { ...prev, detailGroups: arr };
    });
  };

  const removeGroupField = (groupIdx: number, fieldKey: string) => {
    setDraft(prev => {
      const arr = [...prev.detailGroups];
      arr[groupIdx] = { ...arr[groupIdx], fields: arr[groupIdx].fields.filter(f => f.key !== fieldKey) };
      return { ...prev, detailGroups: arr };
    });
  };

  const addGroupField = (groupIdx: number, key: string) => {
    if (!key) return;
    setDraft(prev => {
      const arr = [...prev.detailGroups];
      if (arr[groupIdx].fields.some(f => f.key === key)) return prev;
      arr[groupIdx] = { ...arr[groupIdx], fields: [...arr[groupIdx].fields, { key, label: key }] };
      return { ...prev, detailGroups: arr };
    });
  };

  const updateDetailFieldLabel = (groupIdx: number, key: string, label: string) => {
    setDraft(prev => {
      const arr = [...prev.detailGroups];
      arr[groupIdx] = { ...arr[groupIdx], fields: arr[groupIdx].fields.map(f => f.key === key ? { ...f, label } : f) };
      return { ...prev, detailGroups: arr };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 id={titleId} className="font-medium text-gray-900">{t('builder.title')}</h3>
          <button onClick={onClose} aria-label={t('builder.closeAria')} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {error && <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>}
          {!headers.length && <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">{t('builder.emptyHeaderHint')}</div>}

          <div className="flex gap-2 flex-wrap">
            <button onClick={autoGenerate} disabled={!headers.length} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">{t('builder.generate')}</button>
            <button onClick={exportJson} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">{t('builder.exportJson')}</button>
          </div>
          {diffPreview && (
            <div className="p-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded whitespace-pre-wrap">
              {t('builder.diffPreview')}{diffPreview}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('builder.tableTitle')} <span title={t('builder.tableTitleHint')} className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-gray-100 border border-gray-300 rounded-full cursor-help">?</span></label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('builder.idField')} <span title={t('builder.idFieldHint')} className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-gray-100 border border-gray-300 rounded-full cursor-help">?</span></label>
              <select value={draft.idField} onChange={e => setDraft({ ...draft, idField: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">{t('builder.selectPlaceholder')}</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                {headers.length === 0 && <option value={draft.idField}>{draft.idField}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('builder.nameField')} <span title={t('builder.nameFieldHint')} className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-gray-100 border border-gray-300 rounded-full cursor-help">?</span></label>
              <select value={draft.nameField} onChange={e => setDraft({ ...draft, nameField: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">{t('builder.selectPlaceholder')}</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                {headers.length === 0 && <option value={draft.nameField}>{draft.nameField}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('builder.statusField')} <span title={t('builder.statusFieldHint')} className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-gray-100 border border-gray-300 rounded-full cursor-help">?</span></label>
              <select value={draft.statusField} onChange={e => setDraft({ ...draft, statusField: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option value="">{t('builder.selectPlaceholder')}</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                {headers.length === 0 && <option value={draft.statusField}>{draft.statusField}</option>}
              </select>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('builder.listFieldsTitle')}</h4>
            <div className="border border-gray-200 rounded p-2 max-h-64 overflow-y-auto space-y-1">
              {headers.length ? headers.map(h => {
                const idx = draft.listFields.findIndex(f => f.key === h);
                const selected = idx >= 0;
                const field = draft.listFields[idx];
                return (
                  <div key={h} className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-2 flex-1 min-w-0">
                      <input type="checkbox" checked={selected} onChange={() => toggleListField(h)} />
                      <span className="truncate" title={h}>{h}</span>
                    </label>
                    {selected && field && (
                      <span className="flex gap-1 shrink-0 items-center">
                        <input
                          value={field.label}
                          onChange={e => updateListFieldLabel(h, e.target.value)}
                          placeholder={t('builder.placeholderLabel')}
                          className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs"
                          title={t('builder.editLabelTitle')}
                        />
                        <button onClick={() => moveListField(idx, -1)} className="px-1 py-0.5 border rounded text-xs">↑</button>
                        <button onClick={() => moveListField(idx, 1)} className="px-1 py-0.5 border rounded text-xs">↓</button>
                      </span>
                    )}
                  </div>
                );
              }) : draft.listFields.map((f, i) => (
                <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate">{f.key}</span>
                    <input value={f.label} onChange={e => updateListFieldLabel(f.key, e.target.value)} className="w-24 px-1 py-0.5 border border-gray-300 rounded text-xs" />
                  </span>
                  <span className="flex gap-1">
                    <button onClick={() => moveListField(i, -1)} className="px-1 py-0.5 border rounded text-xs">↑</button>
                    <button onClick={() => moveListField(i, 1)} className="px-1 py-0.5 border rounded text-xs">↓</button>
                    <button onClick={() => toggleListField(f.key)} className="px-1 py-0.5 border rounded text-xs text-red-600">×</button>
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-1">{t('builder.currentOrder')} {draft.listFields.map(f => `${f.key}(${f.label})`).join(' / ') || t('builder.none')}</div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('builder.statusOptionsTitle')}</h4>
            <div className="space-y-2">
              {draft.statusValues.map((sv, i) => (
                <div key={sv.value + '-' + i} className="flex gap-2 items-center">
                  <input placeholder={t('builder.placeholderValue')} value={sv.value} onChange={e => updateStatusValues(i, 'value', e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                  <input placeholder={t('builder.placeholderLabel')} value={sv.label} onChange={e => updateStatusValues(i, 'label', e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                  <select value={sv.color || 'gray'} onChange={e => updateStatusValues(i, 'color', e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm">
                    <option value="gray">gray</option><option value="green">green</option><option value="red">red</option><option value="yellow">yellow</option><option value="blue">blue</option>
                  </select>
                  <button onClick={() => setDraft(prev => ({ ...prev, statusValues: prev.statusValues.filter((_, idx) => idx !== i) }))} className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded">{t('builder.delete')}</button>
                </div>
              ))}
              <button onClick={addStatusValue} className="px-3 py-1 text-sm border border-dashed border-gray-300 rounded hover:bg-gray-50">{t('builder.addStatus')}</button>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">{t('builder.detailGroupsTitle')} <span className="text-xs font-normal text-gray-400">{t('builder.detailGroupsHint')}</span></h4>
              <button onClick={addDetailGroup} className="px-2 py-1 text-xs border border-dashed border-gray-300 rounded hover:bg-gray-50">{t('builder.addGroup')}</button>
            </div>
            <div className="space-y-3">
              {draft.detailGroups.map((group, gi) => (
                <div key={gi} className="border border-gray-200 rounded p-3 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <input value={group.label} onChange={e => updateGroupLabel(gi, e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium" placeholder={t('builder.groupPlaceholder')} />
                    <button onClick={() => removeDetailGroup(gi)} className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded bg-white">{t('builder.deleteGroup')}</button>
                  </div>
                  <div className="space-y-1">
                    {group.fields.map(f => (
                      <div key={f.key} className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded px-2 py-1">
                        <span className="flex-1 truncate" title={f.key}>{f.key}</span>
                        <input value={f.label} onChange={e => updateDetailFieldLabel(gi, f.key, e.target.value)} className="w-28 px-1 py-0.5 border border-gray-300 rounded text-xs" placeholder={t('builder.placeholderLabel')} />
                        <button onClick={() => removeGroupField(gi, f.key)} className="text-red-500 hover:text-red-700">×</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <select id={`add-field-${gi}`} defaultValue="" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                        <option value="">{t('builder.addFieldPlaceholder')}</option>
                        {headers.filter(h => !group.fields.some(f => f.key === h)).map(h => <option key={h} value={h}>{h}</option>)}
                        {headers.length === 0 && draft.listFields.filter(f => !group.fields.some(gf => gf.key === f.key)).map(f => <option key={f.key} value={f.key}>{f.key}</option>)}
                      </select>
                      <button
                        onClick={e => {
                          const sel = (e.currentTarget.previousElementSibling as HTMLSelectElement);
                          if (sel?.value) {
                            addGroupField(gi, sel.value);
                            sel.value = '';
                          }
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50"
                      >
                        {t('builder.add')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {draft.detailGroups.length === 0 && <div className="text-xs text-gray-400">{t('builder.noGroups')}</div>}
              <div className="text-xs text-gray-500">{t('builder.keepConfigHint')}</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-white">{t('builder.cancel')}</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700">{t('builder.apply')}</button>
        </div>
      </div>
    </div>
  );
}
