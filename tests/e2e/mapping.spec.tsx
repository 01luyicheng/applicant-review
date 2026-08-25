import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as XLSX from 'xlsx';
import App from '../../src/App';
import { DEFAULT_CONFIG } from '../../src/types';
import { clearApplicants, loadApplicants } from '../../src/utils/storage';
import i18n, { setLocale } from '../../src/i18n';

function makeXlsxFile(aoa: unknown[][], name = 'mapping.xlsx'): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function mockFetchForApp() {
  const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/config.json') || url.includes('config.json')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(DEFAULT_CONFIG),
        json: async () => DEFAULT_CONFIG,
      } as unknown as Response;
    }
    return { ok: false, status: 404, statusText: 'Not Found', text: async () => '', json: async () => ({}) } as unknown as Response;
  });
  vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);
  if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).fetch = mockFetch as unknown as typeof fetch;
  return mockFetch;
}

async function waitForAppReady(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  }, { timeout: 5000 });
  await waitFor(() => {
    if (screen.queryByText('配置加载中...')) throw new Error('still loading');
  }, { timeout: 5000 });
  await waitFor(() => {
    expect(screen.getByText(/拖拽|Drag/)).toBeInTheDocument();
  }, { timeout: 5000 });
}

describe('E2E 列映射向导 (>30% 阈值)', () => {
  let originalFetch: typeof fetch;
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    sessionStorage.clear();
    localStorage.clear();
    clearApplicants();
    try {
      Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });
      localStorage.setItem('app-locale', 'zh');
      await i18n.changeLanguage('zh');
    } catch {}
    setLocale('zh');
    mockFetchForApp();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).fetch = originalFetch as unknown as typeof fetch;
    }
    sessionStorage.clear();
    localStorage.clear();
    clearApplicants();
  });

  it('>30% 不匹配弹向导、确认后 config 更新、数据落库', async () => {
    const { container } = render(<App />);
    await waitForAppReady(container);

    // 6 列中仅 1 列命中 DEFAULT_CONFIG (姓名)，5 列未知 => missing 5/6 ≈83% >30%
    const aoa = [
      ['姓名', '未知字段A', '未知字段B', '未知字段C', '未知字段D', '未知字段E'],
      ['张三', 'a1', 'b1', 'c1', 'd1', 'e1'],
      ['李四', 'a2', 'b2', 'c2', 'd2', 'e2'],
    ];
    const file = makeXlsxFile(aoa, '高缺失.xlsx');
    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const fileInput = inputs.find(el => !el.disabled) || inputs[0];
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // 向导应出现
    await waitFor(() => {
      expect(screen.getByText(/列映射向导/)).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // 进度条 33% 且显示 6 列
    expect(screen.getByText(/6 列/)).toBeInTheDocument();

    // Step1: 验证表头已渲染，可直接下一步；点击 下一步 -> 新建字段页
    const nextBtn = screen.getByRole('button', { name: '下一步' });
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByText(/未匹配的表头/)).toBeInTheDocument();
    });

    // 勾选 2 个未知字段作为新建 — 通过文本定位更稳健，避免索引漂移
    const findCheckboxForHeader = (header: string) => {
      // 找到包含该 header 文本的行，再取其中的 checkbox
      const textEl = screen.getByText(header);
      const row = textEl.closest('div') as HTMLElement | null;
      if (!row) throw new Error(`row not found for ${header}`);
      const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (cb) return cb;
      // fallback: 遍历所有 checkbox 找邻近文本
      const all = screen.getAllByRole('checkbox') as HTMLInputElement[];
      // 已有 row 找不到时 fallback 到索引匹配
      return all.find(c => c.closest('div')?.textContent?.includes(header)) || all[0];
    };
    fireEvent.click(findCheckboxForHeader('未知字段A'));
    fireEvent.click(findCheckboxForHeader('未知字段B'));

    // 预览 Diff
    const previewBtn = screen.getByRole('button', { name: '预览 Diff' });
    fireEvent.click(previewBtn);
    await waitFor(() => {
      expect(screen.getByText(/确认下列映射变更/)).toBeInTheDocument();
    });
    // Diff 应显示 新增 2 列
    expect(screen.getByText(/新增 2 列/)).toBeInTheDocument();

    // 确认并应用
    const confirmBtn = screen.getByRole('button', { name: '确认并应用' });
    fireEvent.click(confirmBtn);

    // 向导关闭，表格出现数据（>0 行）
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    await waitFor(() => {
      const grid = screen.getByRole('grid', { name: /申请人列表/ });
      const dataRows = Array.from(grid.querySelectorAll('tbody tr')).filter(r => r.querySelector('select[aria-label="切换状态"]'));
      expect(dataRows.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // 验证 config 已更新：localStorage 中 listFields 新增了勾选字段
    const stored = localStorage.getItem('applicant-review-config');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.listFields.some((f: { key: string }) => f.key === '未知字段A')).toBe(true);
    expect(parsed.listFields.some((f: { key: string }) => f.key === '未知字段B')).toBe(true);

    // 验证数据持久化：loadApplicants 可恢复且包含新字段
    const restored = loadApplicants(parsed.title);
    expect(restored).not.toBeNull();
    expect(restored!.length).toBe(2);
    expect(restored![0].raw['未知字段A']).toBe('a1');

    // 验证未勾选的字段仍在 raw 中但未进 config（按设计 raw 仍保留原始键）
    expect(restored![0].raw['未知字段C']).toBe('c1');
  }, 15000);

  it('取消后 config 不变、数据仍以原样落地、向导可关闭', async () => {
    const { container } = render(<App />);
    await waitForAppReady(container);

    const aoa = [
      ['姓名', '未知X', '未知Y', '未知Z', '未知W', '未知V'],
      ['张三', 'x1', 'y1', 'z1', 'w1', 'v1'],
    ];
    const file = makeXlsxFile(aoa, '取消测试.xlsx');
    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const fileInput = inputs.find(el => !el.disabled) || inputs[0];
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/列映射向导/)).toBeInTheDocument();
    }, { timeout: 5000 });

    const beforeStored = localStorage.getItem('applicant-review-config');

    // 点击取消（底部取消按钮）
    const cancelBtns = screen.getAllByRole('button', { name: '取消' });
    // 底部有两个取消，上一步区域也有；取最后一个（底部左侧）
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // config 不应新增字段
    const afterStored = localStorage.getItem('applicant-review-config');
    // 若原本无存储，仍为 null；若有存储，深比较不新增
    if (beforeStored && afterStored) {
      const before = JSON.parse(beforeStored);
      const after = JSON.parse(afterStored);
      expect(after.listFields.length).toBe(before.listFields.length);
      expect(after.listFields.some((f: { key: string }) => f.key === '未知X')).toBe(false);
    } else {
      expect(afterStored).toBe(beforeStored);
    }

    // 数据仍应落地（按取消逻辑：沿用原配置原样加载）
    await waitFor(() => {
      const grid = screen.getByRole('grid', { name: /申请人列表/ });
      const dataRows = Array.from(grid.querySelectorAll('tbody tr')).filter(r => r.querySelector('select[aria-label="切换状态"]'));
      expect(dataRows.length).toBe(1);
    }, { timeout: 5000 });

    // 取消后应有提示 “已取消列映射”
    expect(screen.getByText(/已取消列映射/)).toBeInTheDocument();

    // 再验证 ESC 也可关闭（重新触发向导后 ESC）
    const file2 = makeXlsxFile(aoa, '二次触发.xlsx');
    fireEvent.change(fileInput!, { target: { files: [file2] } });
    await waitFor(() => {
      expect(screen.getByText(/列映射向导/)).toBeInTheDocument();
    }, { timeout: 5000 });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 15000);

  it('≤30% 不匹配不弹向导（边界 30% 不触发）', async () => {
    const { container } = render(<App />);
    await waitForAppReady(container);
    // DEFAULT_CONFIG 6 键中，我们造 4 列：2 已知 +2 未知 => missing 2/4=50% >30% 会弹；要做到 ≤30% 需要 4 列中 missing ≤1
    // 构造 4 列：姓名(已知)、邮箱(已知)、状态(已知)、未知1 => missing 1/4=25% ≤30% 不弹
    const aoa = [
      ['姓名', '邮箱', '状态', '未知1'],
      ['张三', 'a@b.com', '通过', 'x1'],
    ];
    const file = makeXlsxFile(aoa, '低缺失.xlsx');
    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const fileInput = inputs.find(el => !el.disabled) || inputs[0];
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // 等待表格直接渲染，不出现向导
    await waitFor(() => {
      const grid = screen.getByRole('grid', { name: /申请人列表/ });
      const dataRows = Array.from(grid.querySelectorAll('tbody tr')).filter(r => r.querySelector('select[aria-label="切换状态"]'));
      expect(dataRows.length).toBe(1);
    }, { timeout: 5000 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10000);
});
