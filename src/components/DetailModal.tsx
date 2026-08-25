import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewConfig } from '../types';
import { getStatusColor, getStatusLabel } from '../config';

interface DetailModalProps {
  applicant: { id: string; raw: Record<string, string> } | null;
  config: ViewConfig;
  onClose: () => void;
  onStatusChange: (status: string) => void;
}

export default function DetailModal({ applicant, config, onClose, onStatusChange }: DetailModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!applicant) return;
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
  }, [applicant, onClose]);

  if (!applicant) return null;

  const status = applicant.raw[config.statusField] || '';
  const statusLabel = getStatusLabel(status, config);
  const statusClass = getStatusColor(status, config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <span id={titleId} className="font-medium text-gray-900">{applicant.raw[config.nameField] || t('detail.unnamed')}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${statusClass}`}>{statusLabel}</span>
          </div>
          <button onClick={onClose} aria-label={t('detail.closeDetails')} className="text-gray-400 hover:text-gray-600 p-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {config.detailGroups.map(group => (
            <div key={group.label} className="border-b border-gray-100 pb-4 last:border-0">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{group.label}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map(field => {
                  const rawValue = applicant.raw[field.key];
                  const isEmpty = !rawValue || !String(rawValue).trim();
                  const displayValue = isEmpty ? t('detail.empty') : rawValue;
                  return (
                    <div key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                      <div className={`px-3 py-2 rounded text-sm ${field.multiline ? 'whitespace-pre-wrap max-h-60 overflow-y-auto font-normal leading-relaxed' : 'break-all'} ${isEmpty ? 'bg-gray-50 text-gray-400 italic border border-dashed border-gray-200' : 'bg-gray-50 text-gray-900'}`}>
                        {displayValue}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded">
            {t('detail.close')}
          </button>
          {config.statusValues.filter(sv => sv.value).map(sv => (
            <button
              key={sv.value}
              onClick={() => { onStatusChange(sv.value); onClose(); }}
              className={`px-4 py-2 text-sm rounded ${sv.color === 'green' ? 'bg-green-600 text-white hover:bg-green-700' : sv.color === 'red' ? 'bg-red-600 text-white hover:bg-red-700' : sv.color === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700' : sv.color === 'yellow' ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
              disabled={status === sv.value}
            >
              {sv.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}