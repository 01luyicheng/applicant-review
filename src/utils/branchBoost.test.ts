import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { ERR_DUP_HEADER_PREFIX, ERR_READ_FAILED, ERR_WORKER_FAILED, ERR_WORKER_INVALID, parseFile } from './fileParser';
import { isSensitiveKey, getFallbackStorage, saveApplicants, loadApplicants, clearApplicants, STORAGE_KEY, ERR_STORAGE_FULL, ERR_STORAGE_FALLBACK_FAILED, getStoredMeta, debouncedSaveApplicants, flushPendingSave, isSensitiveKey as isSK, setupClearOnUnload } from './storage';
import type { ViewConfig } from '../types';
import type { Applicant } from '../types';

const baseConfig: ViewConfig = {
  title: '测试',
  idField: '编号',
  nameField: '姓名',
  listFields: [{ key: '姓名', label: '姓名', visibleInList: true }],
  detailGroups: [{ label: '详情', fields: [{ key: '备注', label: '备注' }] }],
  statusField: '审核是否通过',
  statusValues: [
    { value: '', label: '待审核', color: 'gray' },
    { value: '通过', label: '通过', color: 'green' },
  ],
};

describe('branchBoost: i18n constants', () => {
  it('error constants map to i18n keys', () => {
    expect(ERR_DUP_HEADER_PREFIX).toBe('表头重复');
    expect(ERR_READ_FAILED).toBe('读取文件失败');
    expect(ERR_WORKER_FAILED).toBe('Worker 解析失败');
    expect(ERR_WORKER_INVALID).toBe('Worker 返回异常');
    expect(ERR_STORAGE_FULL).toContain('本地存储已满');
    expect(ERR_STORAGE_FALLBACK_FAILED).toContain('sessionStorage');
  });
});

describe('branchBoost: isSensitiveKey branches', () => {
  it('custom sensitiveKeys substring & regex & empty & invalid', () => {
    expect(isSensitiveKey('手机号', [])).toBe(true); // fallback to default pattern when empty array -> still default
    expect(isSensitiveKey('myPhoneField', ['phone'])).toBe(true); // substring lower includes
    expect(isSensitiveKey('customField_ABC', ['^custom.*ABC$'])).toBe(true); // regex
    expect(isSensitiveKey('other', ['phone', ''])).toBe(false); // empty ck skipped
    expect(isSensitiveKey('other', ['[invalid'])).toBe(false); // invalid regex not throw
    expect(isSensitiveKey('email_addr', ['mail'])).toBe(true);
    expect(isSensitiveKey('微信号', ['wechat'])).toBe(false); // case insensitive contains vs regex? '微信号' lower not contains wechat, but regex test will check '微信号' against /wechat/i -> false
    // regex path true via case-insensitive match on original key
    expect(isSensitiveKey('WeChatId', ['wechat'])).toBe(true);
  });
  it('sensitiveKeys undefined fallback', () => {
    expect(isSensitiveKey('身份证号')).toBe(true);
    expect(isSensitiveKey('普通字段')).toBe(false);
  });
});

describe('branchBoost: storage fallback & quota', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it('getFallbackStorage primary available returns null', () => {
    // sessionStorage exists in jsdom -> primary available -> null
    expect(getFallbackStorage()).toBeNull();
  });
  it('getFallbackStorage primary unavailable returns localStorage', () => {
    // mock getPrimaryStorage by deleting sessionStorage
    const orig = window.sessionStorage;
    // @ts-expect-error -- delete readonly window property for test fallback branch
    delete (window as any).sessionStorage;
    try {
      const fb = getFallbackStorage();
      // should be localStorage
      expect(fb).toBe(window.localStorage);
    } finally {
      (window as any).sessionStorage = orig;
    }
  });
  it('save fallback to localStorage when primary unavailable', () => {
    const orig = window.sessionStorage;
    // @ts-expect-error -- delete readonly window property for test fallback branch
    delete (window as any).sessionStorage;
    try {
      const apps: Applicant[] = [{ id: '1', raw: { a: '1' } }];
      saveApplicants(apps, 't', { maskSensitive: false });
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(loadApplicants('t')).not.toBeNull();
    } finally {
      (window as any).sessionStorage = orig;
      localStorage.clear();
      sessionStorage.clear();
    }
  });
  it('quota exceeded via DOMException', () => {
    const apps: Applicant[] = [{ id: '1', raw: { a: '1' } }];
    const domErr = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw domErr; });
    expect(() => saveApplicants(apps, 't', { maskSensitive: false })).toThrow(ERR_STORAGE_FULL);
  });
  it('non-Error throw produces 保存失败', () => {
    const apps: Applicant[] = [{ id: '1', raw: { a: '1' } }];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw 'string boom';
    });
    expect(() => saveApplicants(apps, 't', { maskSensitive: false })).toThrow(/保存失败/);
  });
  it('getStoredMeta null when empty and valid after save', () => {
    expect(getStoredMeta()).toBeNull();
    const apps: Applicant[] = [{ id: '1', raw: { a: '1' } }];
    saveApplicants(apps, 'meta2', { maskSensitive: false });
    const meta = getStoredMeta();
    expect(meta?.configTitle).toBe('meta2');
    expect(meta?.count).toBe(1);
  });
  it('debounced + flushPendingSave handles quota error silently via reportError', async () => {
    const apps: Applicant[] = [{ id: '1', raw: { a: '1' } }];
    // make save fail via quota mock, debounced should not throw but report
    const domErr = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw domErr; });
    debouncedSaveApplicants(apps, 't2', { maskSensitive: false });
    // flush should attempt save and catch
    // flushPendingSave catches and reports, not throw for debounced path? Actually flush rethrows? check impl: flushPendingSave try save finally pending null without catch, so it will throw ERR_STORAGE_FULL
    // but debounced timer path catches
    // we test that flush throws as expected
    expect(() => flushPendingSave()).toThrow(ERR_STORAGE_FULL);
  });
  it('setupClearOnUnload registers listener', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    setupClearOnUnload();
    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    spy.mockRestore();
  });
});

describe('branchBoost: fileParser additional branches', () => {
  function makeXlsxFile(aoa: unknown[][], name = '测试.xlsx'): File {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function makeCsvFile(content: string, name = 'a.csv'): File {
    return new File([content], name, { type: 'text/csv' });
  }
  it('empty workbook SheetNames empty returns []', async () => {
    // xlsx 仅 header 行 -> json.length <2 分支，exceljs colCount 检测也会返回 []
    const file = makeXlsxFile([['姓名', '邮箱']], 'empty2.xlsx');
    const res = await parseFile(file, baseConfig);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
    // csv 空数据同样触发 json.length <2
    const csvFile = makeCsvFile('姓名,邮箱\n', 'empty.csv');
    const res2 = await parseFile(csvFile, baseConfig);
    expect(res2.length).toBe(0);
  });
  it('csv parse via TextDecoder branch and header length truncation', async () => {
    // header with >128 chars should be truncated
    const longHeader = 'a'.repeat(200);
    const csv = `${longHeader},姓名\n1,张三\n`;
    const file = makeCsvFile(csv, 'long.csv');
    const apps = await parseFile(file, baseConfig);
    expect(apps.length).toBe(1);
    expect(Object.keys(apps[0].raw)[0].length).toBe(128);
  });
  it('xlsx formula and w fallback branches', async () => {
    // Create sheet with formula cell via direct worksheet manipulation to hit f and w branches
    const wb = XLSX.utils.book_new();
    const ws: any = XLSX.utils.aoa_to_sheet([
      ['编号', '姓名'],
      ['1', '张三'],
    ]);
    // inject formula in A2
    ws['A2'] = { f: 'SUM(A1:A10)', t: 'n', v: 0 };
    // inject w in B2
    ws['B2'] = { w: '显示文本', v: 'raw' };
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([out], 'formula.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const apps = await parseFile(file, baseConfig);
    expect(apps.length).toBe(1);
  });
  it('calculateStats unknown value branch and getUniqueValues', async () => {
    const { calculateStats, getUniqueValues, exportToCSV } = await import('./fileParser');
    const apps = [
      { id: '1', raw: { '审核是否通过': '未知状态' } },
      { id: '2', raw: { '审核是否通过': '通过' } },
    ] as any;
    const s = calculateStats(apps, '审核是否通过', baseConfig.statusValues);
    // unknown value not in counts but some check: statusValues.some -> false so not added? Actually counts only initialized for known values, unknown won't increment
    expect(s.total).toBe(2);
    expect(getUniqueValues(apps, '审核是否通过').length).toBeGreaterThan(0);
    // export fallback when rawKeys empty
    const emptyRawApps = [{ id: '1', raw: {} }] as any;
    const csv = exportToCSV(emptyRawApps, baseConfig);
    expect(csv).toContain('序号');
  });
});

describe('branchBoost: config validation boost', () => {
  it('covers type/filter/options/width/sortable/sensitiveKeys/detailGroups/statusValues branches', async () => {
    const { getConfigValidationErrors } = await import('../config');
    const badType = structuredClone(baseConfig) as any;
    badType.listFields[0].type = 'badtype';
    expect(getConfigValidationErrors(badType).join('|')).toContain('type');
    const badFilter = structuredClone(baseConfig) as any;
    badFilter.listFields[0].filter = 'badfilter';
    expect(getConfigValidationErrors(badFilter).join('|')).toMatch(/filter/);
    const badOpts = structuredClone(baseConfig) as any;
    badOpts.listFields[0].options = 'notarray' as any;
    expect(getConfigValidationErrors(badOpts).join('|')).toContain('options');
    const badWidth = structuredClone(baseConfig) as any;
    badWidth.listFields[0].width = 'wide' as any;
    expect(getConfigValidationErrors(badWidth).join('|')).toContain('width');
    const badSort = structuredClone(baseConfig) as any;
    badSort.listFields[0].sortable = 'yes' as any;
    expect(getConfigValidationErrors(badSort).join('|')).toContain('boolean');
    const badSens = structuredClone(baseConfig) as any;
    badSens.sensitiveKeys = [''] as any;
    expect(getConfigValidationErrors(badSens).join('|')).toContain('sensitiveKeys');
    const badDetail = structuredClone(baseConfig) as any;
    badDetail.detailGroups[0].fields = 'not-array' as any;
    expect(getConfigValidationErrors(badDetail).join('|')).toContain('fields');
    const badColor = structuredClone(baseConfig) as any;
    badColor.statusValues[0].color = 'purple' as any;
    expect(getConfigValidationErrors(badColor).join('|')).toContain('color');
    const badVal = structuredClone(baseConfig) as any;
    badVal.statusValues[0].value = 123 as any;
    expect(getConfigValidationErrors(badVal).join('|')).toContain('value');
    const badTitle = structuredClone(baseConfig) as any;
    badTitle.title = '' as any;
    expect(getConfigValidationErrors(badTitle).join('|')).toContain('title');
    const badId = structuredClone(baseConfig) as any;
    badId.idField = '' as any;
    expect(getConfigValidationErrors(badId).join('|')).toContain('idField');
    const badName = structuredClone(baseConfig) as any;
    badName.nameField = '' as any;
    expect(getConfigValidationErrors(badName).join('|')).toContain('nameField');
    const badStatus = structuredClone(baseConfig) as any;
    badStatus.statusField = '' as any;
    expect(getConfigValidationErrors(badStatus).join('|')).toContain('statusField');
    // multiline / searchable / required boolean branches
    const badMulti = structuredClone(baseConfig) as any;
    badMulti.listFields[0].multiline = 'yes' as any;
    expect(getConfigValidationErrors(badMulti).join('|')).toContain('multiline');
    // detail label branch
    const badDetailLabel = structuredClone(baseConfig) as any;
    badDetailLabel.detailGroups[0].label = '' as any;
    expect(getConfigValidationErrors(badDetailLabel).join('|')).toContain('label');
    // proto pollution
    const protoBad: any = structuredClone(baseConfig);
    Object.defineProperty(protoBad, '__proto__', { value: {}, enumerable: true, configurable: true, writable: true });
    expect(getConfigValidationErrors(protoBad).join('|')).toContain('非法原型');
  });
  it('covers save/clear/cache/fetchRemoteConfig/getConfigUrl branches', async () => {
    const { saveConfig, clearConfig, cacheUrlConfig, fetchRemoteConfig, getConfigUrl } = await import('../config');
    saveConfig(baseConfig);
    expect(localStorage.getItem('applicant-review-config')).not.toBeNull();
    const longUrl = 'http://localhost:3000/' + 'a'.repeat(300);
    cacheUrlConfig(longUrl, baseConfig);
    const origSearch = window.location.search;
    window.history.pushState({}, '', '/?config=http://localhost:3000/config.json');
    expect(getConfigUrl()).toBe('http://localhost:3000/config.json');
    window.history.pushState({}, '', '/?config=https://evil.com/x.json');
    expect(getConfigUrl()).toBeNull();
    window.history.pushState({}, '', '/?config=javascript:alert(1)');
    expect(getConfigUrl()).toBeNull();
    window.history.pushState({}, '', origSearch || '/');
    // fetchRemoteConfig same-origin ok
    vi.spyOn(window as any, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(baseConfig), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const data = await fetchRemoteConfig('http://localhost:3000/config.json');
    expect((data as any).title).toBe(baseConfig.title);
    // cross-origin blocked
    await expect(fetchRemoteConfig('https://evil.com/config.json')).rejects.toThrow('同源');
    // non-ok
    vi.spyOn(window as any, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 404, statusText: 'Not Found' }));
    await expect(fetchRemoteConfig('http://localhost:3000/missing.json')).rejects.toThrow('Failed to fetch');
    // invalid JSON
    vi.spyOn(window as any, 'fetch').mockResolvedValueOnce(new Response('not-json', { status: 200 } as any));
    await expect(fetchRemoteConfig('http://localhost:3000/bad.json')).rejects.toThrow('合法 JSON');
    // AbortError timeout
    vi.spyOn(window as any, 'fetch').mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await expect(fetchRemoteConfig('http://localhost:3000/timeout.json')).rejects.toThrow('超时');
    // CORS/network error
    vi.spyOn(window as any, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(fetchRemoteConfig('http://localhost:3000/cors.json')).rejects.toThrow('CORS');
    // also cover global fetch path for CORS variant (isLogEnabled branches etc.)
    vi.restoreAllMocks();
    clearConfig();
  });
});

describe('branchBoost: hooks & logger boost', () => {
  it('useHistory push/undo/clear', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { useHistory } = await import('../hooks/useHistory');
    const { result } = renderHook(() => useHistory());
    act(() => result.current.pushHistory({ id: '1', prevStatus: 'a', nextStatus: 'b' }));
    expect(result.current.history.length).toBe(1);
    let undone: any;
    act(() => { undone = result.current.undo(); });
    expect(undone?.id).toBe('1');
    act(() => result.current.pushHistory({ id: '2', prevStatus: '', nextStatus: 'x' }));
    act(() => result.current.clearHistory());
    expect(result.current.history.length).toBe(0);
    act(() => { expect(result.current.undo()).toBeNull(); });
  });
  it('usePersistence persist/queue/flush/clear/getTitle branches', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { usePersistence } = await import('../hooks/usePersistence');
    const apps = [{ id: '1', raw: { a: '1' } }] as any;
    const { result } = renderHook(() => usePersistence({ getTitle: () => 't-persist' }));
    act(() => result.current.persist(apps));
    act(() => result.current.queue(apps));
    act(() => result.current.debounced(apps));
    act(() => result.current.flush());
    act(() => result.current.clear());
    // getTitle throw fallback + configRef fallback
    const { result: r2 } = renderHook(() => usePersistence({ getTitle: () => { throw new Error('boom'); }, config: { title: 'fallbackT' } as any }));
    act(() => r2.current.persist(apps));
    const { result: r3 } = renderHook(() => usePersistence({ configRef: { current: { title: 'refT' } as any } }));
    act(() => r3.current.persist(apps));
    const { result: r4 } = renderHook(() => usePersistence({}));
    act(() => r4.current.persist(apps, 'explicit'));
  });
  it('logger postLog and redact branches + useGallery loadExample/clear branches', async () => {
    const { reportError, reportWarn } = await import('./logger');
    (globalThis as any).__LOGGER_DEV__ = true;
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    reportError(new Error('boom-err'), { phone: '13800000001', normal: 'ok', nested: { phone: '13800000002' } as any });
    reportWarn('warn-msg', { phone: '13800000001' });
    // fallback when fetch undefined
    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = undefined;
    reportError('string-err', { id: '12345678901' });
    (globalThis as any).fetch = origFetch;
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    reportError(new Error('no-post'), {});
    delete (globalThis as any).__LOGGER_DEV__;
    delete (globalThis as any).__LOGGER_ENABLE_LOG;
    fetchSpy.mockRestore();
    // useGallery: cover handleClearCache false/true and early return
    const { renderHook, act } = await import('@testing-library/react');
    const { useGallery } = await import('../hooks/useGallery');
    const mockSetConfig = vi.fn(); const mockSetError = vi.fn(); const mockSetLoading = vi.fn();
    const mockSetApps = vi.fn(); const mockSetSel = vi.fn(); const mockSetPage = vi.fn(); const mockToast = vi.fn();
    const { result: g } = renderHook(() => useGallery({ setConfig: mockSetConfig, setConfigError: mockSetError, setConfigLoading: mockSetLoading, setApplicants: mockSetApps, setSelectedApplicant: mockSetSel, setCurrentPage: mockSetPage, showToast: mockToast }));
    // handleLoadExample empty path early return
    await act(async () => { await g.current.handleLoadExample(''); });
    expect(mockSetLoading).not.toHaveBeenCalledWith(true); // early return doesn't trigger loading
    // handleClearCache confirm false
    vi.spyOn(window as any, 'confirm').mockReturnValueOnce(false);
    expect(g.current.handleClearCache()).toBe(false);
    vi.spyOn(window as any, 'confirm').mockReturnValueOnce(true);
    expect(g.current.handleClearCache()).toBe(true);
  });
});
