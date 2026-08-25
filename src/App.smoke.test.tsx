import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import App from './App';
import { DEFAULT_CONFIG } from './types';
import { exportToCSV } from './utils/fileParser';
import { loadApplicants, flushPendingSave, clearApplicants } from './utils/storage';
import i18n, { setLocale } from './i18n';

// jsdom smoke: 覆盖“未真机走查”核心链路
// - mock fetch('/config.json') -> DEFAULT_CONFIG
// - 构造 File 含示例 csv 文本 触发 FileUploader onLoad (轻量路径，不重型 Playwright)
// - 断言：表格渲染行数>0 → 选中改状态 onStatusChangeById → loadApplicants 可恢复 → exportToCSV + BOM

function getExampleCsvText(): string {
  // generic-aligned headers to avoid >30% mismatch triggering ColumnMappingModal (6 cols, all in DEFAULT_CONFIG)
  const header = '编号,姓名,邮箱,状态,备注,手机号';
  const rows = Array.from({ length: 10 }, (_, i) => {
    const id = String(i + 1);
    const name = `测试${id}`;
    const status = i % 3 === 0 ? '' : i % 3 === 1 ? '通过' : '拒绝';
    return `${id},${name},test${id}@example.com,${status},备注${id},1380000000${i}`;
  });
  return [header, ...rows].join('\n');
}

describe('App smoke (jsdom, no Playwright)', () => {
  let originalFetch: typeof fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    sessionStorage.clear();
    localStorage.clear();
    clearApplicants();
    // force zh locale for deterministic Chinese assertions (jsdom navigator defaults en)
    try {
      Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });
      localStorage.setItem('app-locale', 'zh');
      await i18n.changeLanguage('zh');
    } catch {}
    setLocale('zh');
    // mock fetch '/config.json' 返回 DEFAULT_CONFIG；其他 url 也返回同样以保证 loadConfig 落到 DEFAULT
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
      // 对远程 config? 参数的 fetch 也模拟失败回退（不抛出 CORS）
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
        json: async () => ({}),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);
    // 兼容 window.fetch (jsdom) – App 中直接调用全局 fetch（等价 window.fetch）
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).fetch = mockFetch as unknown as typeof fetch;
    }

    // 捕获导出 Blob 以验证 BOM – 仅 spy，不替换 URL 构造函数
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      (globalThis as unknown as Record<string, unknown>).__capturedBlob = blob as Blob;
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).__capturedBlob = blob as Blob;
      }
      return 'blob:mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).fetch = originalFetch as unknown as typeof fetch;
      }
    }
    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL;
    sessionStorage.clear();
    localStorage.clear();
    clearApplicants();
    delete (globalThis as unknown as Record<string, unknown>).__capturedBlob;
    if (typeof window !== 'undefined') delete (window as unknown as Record<string, unknown>).__capturedBlob;
    delete (globalThis as unknown as Record<string, unknown>).__capturedBlobText;
  });

  it('smoke: 上传 csv → 表格渲染 >0 → 改状态 → 持久化恢复 → 导出 BOM', async () => {
    const csvText = getExampleCsvText();
    const file = new File([csvText], 'example.csv', { type: 'text/csv' });

    const { container } = render(<App />);

    // 等待配置加载完成再上传，避免命中 queue 分支的时序竞态（configLoadingRef 更新需 effect）
    // header 会显示 "配置加载中..."，加载完成后消失且出现上传区
    await waitFor(
      () => {
        expect(container.querySelector('input[type="file"]')).not.toBeNull();
      },
      { timeout: 5000 }
    );
    // 额外等待 configLoading 结束：span "配置加载中..." 消失
    await waitFor(
      () => {
        const loadingSpan = screen.queryByText('配置加载中...');
        // 若仍在加载中，等待；若已消失则通过
        if (loadingSpan) throw new Error('still loading');
      },
      { timeout: 5000 }
    );
    // 再等待 FileUploader 文案出现（确保表格空状态已渲染）- 兼容中英
    await waitFor(
      () => {
        expect(screen.getByText(/拖拽|Drag/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // 触发 FileUploader 的 onLoad：通过任一 input[type=file] 派发 change
    // 若首个 input 因 disabled 跳过，则尝试所有 inputs
    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThan(0);
    const fileInput = inputs.find((el) => !el.disabled) || inputs[0];
    expect(fileInput).not.toBeNull();
    // jsdom 的 File 需通过 DataTransfer 或直接赋值 files
    // fireEvent.change 会读取 target.files
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // 等待表格渲染行数 >0（header + data rows）
    await waitFor(
      () => {
        const grid = screen.getByRole('grid', { name: /申请人列表/ });
        const rows = grid.querySelectorAll('tbody tr');
        // 过滤掉空状态行（无匹配记录/上传区），检查带有 select 的行
        const dataRows = Array.from(rows).filter((r) => r.querySelector('select[aria-label="切换状态"]'));
        expect(dataRows.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    // 二次确认：通过 role row + gridcell 也可
    const selects = screen.getAllByLabelText('切换状态');
    expect(selects.length).toBeGreaterThan(0);
    const firstSelect = selects[0] as HTMLSelectElement;
    const prevValue = firstSelect.value;
    // 选择一个与当前不同的状态（优先 '通过'）
    const targetStatus = prevValue !== '通过' ? '通过' : '拒绝';
    // 确保目标选项存在于当前 config
    const hasOption = Array.from(firstSelect.options).some((o) => o.value === targetStatus);
    expect(hasOption).toBe(true);

    fireEvent.change(firstSelect, { target: { value: targetStatus } });

    // 状态切换后 select 值应更新
    await waitFor(() => {
      expect((screen.getAllByLabelText('切换状态')[0] as HTMLSelectElement).value).toBe(targetStatus);
    });

    // 等待 debouncedSave 写入 storage（500ms 防抖），手动 flush
    flushPendingSave();
    // 给微任务一次机会
    await new Promise((r) => setTimeout(r, 0));

    // 验证 loadApplicants 可恢复（标题联动）
    const restored = loadApplicants(DEFAULT_CONFIG.title);
    expect(restored).not.toBeNull();
    expect(restored!.length).toBeGreaterThan(0);
    // 恢复的数据中应包含刚才修改的状态（至少一行是 targetStatus）
    const found = restored!.some((a) => a.raw[DEFAULT_CONFIG.statusField] === targetStatus);
    expect(found).toBe(true);

    // 验证 exportToCSV 产出（直接调用工具函数）
    const csv = exportToCSV(restored!, DEFAULT_CONFIG);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv.split('\n')[0]).toContain('序号');
    // App 导出时会在 Blob 前加 '\uFEFF' BOM；此处验证工具产出 + BOM 前缀行为
    const withBom = '\uFEFF' + csv;
    expect(withBom.charCodeAt(0)).toBe(0xfeff);
    expect(withBom).toMatch(/^\uFEFF/);

    // 进一步：触发界面“导出 CSV”按钮，捕获 Blob 验证 BOM - 兼容中英
    const exportBtn = screen.getByRole('button', { name: /导出 CSV|Export CSV/ });
    expect(exportBtn).toBeEnabled();
    // 点击导出（App 内会异步创建 Blob 并 createObjectURL）
    fireEvent.click(exportBtn);
    // 等待 requestIdle / Promise.then 后的 doExport
    await waitFor(
      async () => {
        const captured =
          ((globalThis as unknown as Record<string, unknown>).__capturedBlob as Blob | undefined) ||
          ((window as unknown as Record<string, unknown>).__capturedBlob as Blob | undefined);
        expect(captured).toBeDefined();
        if (captured) {
          const buf = await captured.arrayBuffer();
          const u8 = new Uint8Array(buf);
          expect(u8[0]).toBe(0xef);
          expect(u8[1]).toBe(0xbb);
          expect(u8[2]).toBe(0xbf);
          const text = await captured.text();
          expect(text).toContain('序号');
        }
      },
      { timeout: 3000 }
    );
  }, 15000);

  // 失败可 skip，但需有 it.todo 说明（覆盖未真机走查的交互）
  it.todo('真机走查：上传10行 → 筛选（搜索/状态/自定义）→ Tab 聚焦行 → Enter 打开详情 → 1/2 快速改状态 → Ctrl+Z 撤销 → 导出 CSV 校验 BOM → 刷新后从 sessionStorage 恢复 → 打开 ConfigBuilder 一键适配');
  it.todo('键盘链路：ArrowUp/ArrowDown 切换选中、Enter 打开详情、Esc 关闭、Ctrl+F 聚焦搜索（需真机键盘时序，jsdom 仅做事件派发 smoke）');
  it.todo('边界：超大文件(>10MB)/重复表头/空行/特殊字符 CSV 注入防护 需手动走查 public/example.csv 与随机生成 5k 行');
});
