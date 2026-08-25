import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { DEFAULT_CONFIG } from '../types';

// mock config module
const mockLoadConfig = vi.fn();
const mockGetConfigUrl = vi.fn();
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
    getConfigUrl: (...args: unknown[]) => mockGetConfigUrl(...args),
  };
});

// mock storage
const mockLoadApplicants = vi.fn();
const mockReadWithMigration = vi.fn();
vi.mock('../utils/storage', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    loadApplicants: (...args: unknown[]) => mockLoadApplicants(...args),
    readWithMigration: (...args: unknown[]) => mockReadWithMigration(...args),
  };
});

import { useConfig } from './useConfig';

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockGetConfigUrl.mockReturnValue(null);
    mockLoadConfig.mockResolvedValue(DEFAULT_CONFIG);
    mockLoadApplicants.mockReturnValue(null);
    mockReadWithMigration.mockReturnValue(null);
    document.title = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('configLoading true -> false and config loaded', async () => {
    const { result } = renderHook(() => useConfig());
    // initial loading true
    expect(result.current.configLoading).toBe(true);
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    expect(result.current.configError).toBeNull();
    expect(document.title).toContain(DEFAULT_CONFIG.title);
  });

  it('queuePendingFile stores file in pendingFileRef', async () => {
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    const file = new File(['hello'], 'test.csv', { type: 'text/csv' });
    act(() => {
      result.current.queuePendingFile(file);
    });
    expect(result.current.pendingFileRef.current).toBe(file);
    expect(result.current.configLoadingRef.current).toBe(false);
    expect(result.current.configRef.current).toEqual(DEFAULT_CONFIG);
  });

  it('remote fallback sets configError when urlParam but no cache', async () => {
    const remoteUrl = window.location.origin + '/remote-config.json';
    mockGetConfigUrl.mockReturnValue(remoteUrl);
    // loadConfig returns DEFAULT_CONFIG to simulate fallback
    mockLoadConfig.mockResolvedValue(DEFAULT_CONFIG);
    sessionStorage.clear();
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    // should have fallback warning
    expect(result.current.configError).toContain('远程配置加载失败');
    expect(result.current.configError).toContain(remoteUrl);
  });

  it('mismatch cache detection appends configError', async () => {
    mockGetConfigUrl.mockReturnValue(null);
    mockLoadConfig.mockResolvedValue({ ...DEFAULT_CONFIG, title: '新标题' });
    mockLoadApplicants.mockReturnValue(null);
    mockReadWithMigration.mockReturnValue(JSON.stringify({ configTitle: '旧标题', applicants: [{ id: '1', raw: { a: '1' } }] }));
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    expect(result.current.configError).toContain('检测到本地缓存');
    expect(result.current.configError).toContain('旧标题');
    expect(result.current.configError).toContain('新标题');
  });

  it('loadConfig throw sets configError', async () => {
    mockLoadConfig.mockRejectedValue(new Error('network fail'));
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    expect(result.current.configError).toContain('配置加载失败');
    expect(result.current.configError).toContain('network fail');
  });

  it('reload re-invokes initConfig', async () => {
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    expect(mockLoadConfig).toHaveBeenCalledTimes(1);
    mockLoadConfig.mockResolvedValueOnce({ ...DEFAULT_CONFIG, title: '重载标题' });
    await act(async () => {
      await result.current.reload();
    });
    expect(mockLoadConfig).toHaveBeenCalledTimes(2);
    expect(result.current.config.title).toBe('重载标题');
    expect(result.current.configLoading).toBe(false);
  });

  it('setConfig and setConfigError are exposed', async () => {
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    act(() => {
      result.current.setConfig({ ...DEFAULT_CONFIG, title: '手动标题' });
    });
    expect(result.current.config.title).toBe('手动标题');
    act(() => {
      result.current.setConfigError('manual error');
    });
    expect(result.current.configError).toBe('manual error');
  });
});
