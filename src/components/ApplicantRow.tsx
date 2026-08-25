import { useState, memo } from 'react';
import { ViewConfig, FieldConfig } from '../types';
import { getStatusColor, getStatusLabel } from '../config';

interface ApplicantRowProps {
  applicant: { id: string; raw: Record<string, string> };
  config: ViewConfig;
  listFields?: FieldConfig[];
  index: number;
  onRowClick: (applicant: { id: string; raw: Record<string, string> }) => void;
  onStatusChangeById: (id: string, status: string) => void;
  isSelected: boolean;
}

function ApplicantRow({ applicant, config, listFields: propListFields, index, onRowClick, onStatusChangeById, isSelected }: ApplicantRowProps) {
  const listFields = propListFields ?? config.listFields.filter(f => f.visibleInList && f.key !== config.nameField);
  const status = applicant.raw[config.statusField] || '';
  const statusLabel = getStatusLabel(status, config);
  const statusClass = getStatusColor(status, config);
  const [expanded, setExpanded] = useState(false);

  const nameValue = applicant.raw[config.nameField] || '-';

  const handleRowActivate = () => onRowClick(applicant);
  return (
    <tr
      role="row"
      aria-selected={isSelected}
      aria-rowindex={index + 1}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowActivate(); } }}
      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-900 ${isSelected ? 'bg-blue-50' : ''}`}
      onClick={handleRowActivate}
    >
      <td role="gridcell" aria-selected={isSelected} className="px-3 py-2 text-sm text-gray-500 w-12" title={String(index + 1)}>{index + 1}</td>
      <td role="gridcell" aria-selected={isSelected} className={`px-3 py-2 text-sm font-medium max-w-[150px] truncate sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.06)] ${isSelected ? 'bg-blue-50 text-gray-900' : 'bg-white text-gray-900'}`} title={nameValue}>
        <span className="cursor-pointer" onClick={e => {
          if (nameValue.length > 10) {
            e.stopPropagation();
            setExpanded(v => !v);
          }
        }}>
          {nameValue}
        </span>
      </td>
      {listFields.map(field => {
        const rawValue = applicant.raw[field.key] || '-';
        return (
          <td
            key={field.key}
            role="gridcell"
            aria-selected={isSelected}
            className={`px-3 py-2 text-sm text-gray-600 ${expanded ? 'whitespace-normal break-all max-w-[300px]' : 'max-w-[150px] truncate'}`}
            title={rawValue}
            onClick={e => {
              e.stopPropagation();
              if (rawValue.length > 15) setExpanded(v => !v);
              else handleRowActivate();
            }}
          >
            {rawValue}
          </td>
        );
      })}
      <td role="gridcell" aria-selected={isSelected} className="px-3 py-2 text-sm font-medium whitespace-nowrap" title={statusLabel}>
        <span className={`px-2 py-0.5 rounded text-xs ${statusClass}`}>{statusLabel}</span>
      </td>
      <td role="gridcell" aria-selected={isSelected} className={`px-3 py-2 text-sm text-gray-500 whitespace-nowrap sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.06)] ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
        <select
          value={status}
          onChange={e => { e.stopPropagation(); onStatusChangeById(applicant.id, e.target.value); }}
          onClick={e => e.stopPropagation()}
          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
          title="切换状态"
          aria-label="切换状态"
        >
          {config.statusValues.map(sv => (
            <option key={sv.value} value={sv.value}>{sv.label}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export default memo(ApplicantRow);
