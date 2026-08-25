// SPDX-License-Identifier: MIT
import { useCallback } from 'react';
import { Applicant, ViewConfig } from '../types';
import { exportToCSV } from '../utils/fileParser';

/**
 * slugify: 将标题转为安全文件名片段，保留中英文、数字，下划线视为单词字符
 * 与 App.tsx 原逻辑保持一致：trim → 非\w/非中文 → '-' → 去首尾'-' → 80 截断 → 空回退 'export'
 */
export function slugify(str: string): string {
  return (
    str
      .trim()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'export'
  );
}

/**
 * useExport: 封装 exportToCSV + Blob 下载 + 大数据量 idle 调度
 * 使 App.tsx 瘦身 ~30 行，保持原有导出行为（BOM、文件名、requestIdleCallback 阈值 5000）
 */
export function useExport(filteredApplicants: Applicant[], config: ViewConfig) {
  const exportCSV = useCallback(() => {
    if (!filteredApplicants.length) return;
    const doExport = () => {
      const csv = exportToCSV(filteredApplicants, config);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `${slugify(config.title)}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (filteredApplicants.length > 5000) {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(doExport, { timeout: 200 });
      } else {
        setTimeout(doExport, 0);
      }
    } else {
      void Promise.resolve().then(doExport);
    }
  }, [filteredApplicants, config]);

  return { exportCSV, slugify };
}

export default useExport;
