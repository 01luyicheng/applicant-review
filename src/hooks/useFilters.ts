import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Applicant, ViewConfig, FilterState } from '../types';

/**
 * Phase0 抽离 App.tsx 中的 filters / filteredApplicants / paginatedApplicants / totalPages / page 逻辑
 * - 包含 useMemo 过滤与分页（搜索 + 状态 + custom 精确匹配）
 * - 分页：pageSize 可配，currentPage 受控且在 filters/pageSize 变化时重置，缩容时 clamp
 * - 另提供 filteredIndexMap（id -> filtered index）用于键盘快捷键与选中跳转
 * - TODO(next): 未来可与 useApplicants 合并为 useApplicantList
 */
export interface UseFiltersOptions {
  initialFilters?: FilterState;
  initialPage?: number;
  initialPageSize?: number;
}

export interface UseFiltersReturn {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  filteredApplicants: Applicant[];
  paginatedApplicants: Applicant[];
  totalPages: number;
  filteredIndexMap: Map<string, number>;
  clearFilters: () => void;
  pageStart: number;
  pageEnd: number;
}

export function useFilters(
  applicants: Applicant[],
  config: ViewConfig,
  options?: UseFiltersOptions
): UseFiltersReturn {
  const [filters, setFilters] = useState<FilterState>(
    options?.initialFilters ?? {
      search: '',
      status: '',
      custom: {},
    }
  );
  const [currentPage, setCurrentPage] = useState<number>(options?.initialPage ?? 1);
  const [pageSize, setPageSize] = useState<number>(options?.initialPageSize ?? 50);

  const filteredApplicants = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    const hasSearch = searchLower.length > 0;
    const statusFilter = filters.status;
    const customEntries = Object.entries(filters.custom).filter(([, v]) => !!v);
    if (!hasSearch && !statusFilter && customEntries.length === 0) return applicants;
    return applicants.filter((a) => {
      const searchMatch =
        !hasSearch || Object.values(a.raw).some((v) => (v || '').toLowerCase().includes(searchLower));
      if (!searchMatch) return false;
      const statusMatch = !statusFilter || a.raw[config.statusField] === statusFilter;
      if (!statusMatch) return false;
      for (const [k, v] of customEntries) {
        if (a.raw[k] !== v) return false;
      }
      return true;
    });
  }, [applicants, filters, config.statusField]);

  // reset to first page when filters change or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  // clamp currentPage when filteredApplicants shrinks
  const totalPages = Math.max(1, Math.ceil(filteredApplicants.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedApplicants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApplicants.slice(start, start + pageSize);
  }, [filteredApplicants, currentPage, pageSize]);

  // id -> index map for O(1) lookup (handleSelectById)
  const filteredIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    filteredApplicants.forEach((a, i) => m.set(a.id, i));
    return m;
  }, [filteredApplicants]);

  const clearFilters = useCallback(() => {
    setFilters({ search: '', status: '', custom: {} });
  }, []);

  const pageStart = filteredApplicants.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredApplicants.length);

  return {
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    filteredApplicants,
    paginatedApplicants,
    totalPages,
    filteredIndexMap,
    clearFilters,
    pageStart,
    pageEnd,
  };
}

export default useFilters;
