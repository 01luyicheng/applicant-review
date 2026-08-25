import { useEffect, useRef } from 'react';
import type { ViewConfig, ReviewStatus } from '../types';

export function useKeyboardShortcuts(
  filteredApplicants: { id: string; raw: Record<string, string> }[],
  filteredIndexMap: Map<string, number>,
  selectedId: string | null,
  onSelect: (id: string | null) => void,
  onStatusChange: (id: string, status: ReviewStatus) => void,
  config: ViewConfig,
  onOpenDetail: (applicant: { id: string; raw: Record<string, string> }) => void
) {
  const statusValuesRef = useRef<ViewConfig['statusValues']>([]);
  const applicantsRef = useRef(filteredApplicants);
  const indexMapRef = useRef(filteredIndexMap);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onStatusChangeRef = useRef(onStatusChange);
  const onOpenDetailRef = useRef(onOpenDetail);

  applicantsRef.current = filteredApplicants;
  indexMapRef.current = filteredIndexMap;
  selectedIdRef.current = selectedId;
  statusValuesRef.current = config.statusValues.filter(s => s.value);
  onSelectRef.current = onSelect;
  onStatusChangeRef.current = onStatusChange;
  onOpenDetailRef.current = onOpenDetail;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      const applicants = applicantsRef.current;
      const indexMap = indexMapRef.current;
      const selectedId = selectedIdRef.current;
      const statusValues = statusValuesRef.current;
      if (!applicants.length) return;

      const currentIndex = selectedId ? (indexMap.get(selectedId) ?? -1) : -1;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, applicants.length - 1) : 0;
          onSelectRef.current(applicants[nextIndex].id);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const nextIndex = currentIndex > 0 ? currentIndex - 1 : applicants.length - 1;
          onSelectRef.current(applicants[nextIndex].id);
          break;
        }
        case 'Enter': {
          if (selectedId) {
            const idx = indexMap.get(selectedId);
            const applicant = idx !== undefined ? applicants[idx] : undefined;
            if (applicant) onOpenDetailRef.current(applicant);
          }
          break;
        }
        case 'Escape': {
          onSelectRef.current(null);
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          if (selectedId && statusValues.length) {
            const num = parseInt(e.key, 10) - 1;
            if (num < statusValues.length) {
              onStatusChangeRef.current(selectedId, statusValues[num].value);
            }
          }
          break;
        }
        case 'f':
        case 'F': {
          if ((e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            // ideally receive searchInputRef from FilterBar, fallback to generic selector
            const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
            searchInput?.focus();
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}