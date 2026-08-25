import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewConfig } from '../types';
import { getStatusColor } from '../config';
import { calculateStats } from '../utils/fileParser';

interface StatsBarProps {
  applicants: { id: string; raw: Record<string, string> }[];
  config: ViewConfig;
  filteredCount: number;
}

export default function StatsBar({ applicants, config, filteredCount }: StatsBarProps) {
  const { t } = useTranslation();
  const { total, counts, pending } = useMemo(
    () => calculateStats(applicants, config.statusField, config.statusValues),
    [applicants, config.statusField, config.statusValues]
  );

  return (
    <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
      <span>{t('stats.total')}: <strong className="text-gray-900">{total}</strong></span>
      <span>{t('stats.filtered')}: <strong className="text-gray-900">{filteredCount}</strong></span>
      {config.statusValues.map(sv => (
        <span key={sv.value} className={`font-medium ${sv.value === '' ? 'text-gray-500' : ''}`}>
          <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(sv.value, config)}`}>
            {sv.label}
          </span>: <strong>{counts[sv.value] || 0}</strong>
        </span>
      ))}
      <span className="text-gray-500">{t('stats.pendingShort')}: <strong>{pending}</strong></span>
    </div>
  );
}
