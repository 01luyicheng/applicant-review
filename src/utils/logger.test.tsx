import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError, reportWarn } from './logger';

describe('logger', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const origDev = (globalThis as any).__LOGGER_DEV__;
  const origEnable = (globalThis as any).__LOGGER_ENABLE_LOG__ ?? (globalThis as any).__LOGGER_ENABLE_LOG;
  // logger uses __LOGGER_ENABLE_LOG (without extra underscores) – check name
  beforeEach(() => {
    vi.restoreAllMocks();
    try { delete (window as any).SENTRY; } catch {}
    // reset global injection flags
    try { delete (globalThis as any).__LOGGER_DEV__; } catch {}
    try { delete (globalThis as any).__LOGGER_ENABLE_LOG; } catch {}
    // ensure default DEV path (import.meta.env.DEV === true in test) unless overridden
    fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    try { delete (window as any).SENTRY; } catch {}
    try { delete (globalThis as any).__LOGGER_DEV__; } catch {}
    try { delete (globalThis as any).__LOGGER_ENABLE_LOG; } catch {}
    // restore originals if needed
    if (origDev !== undefined) (globalThis as any).__LOGGER_DEV__ = origDev;
    // fetch restore handled by vi.restoreAllMocks
  });

  it('reportError dev=true 时 console.error + Sentry captureException 优先，不走 fetch', () => {
    (globalThis as any).__LOGGER_DEV__ = true;
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    (window as any).SENTRY = { captureException: vi.fn(), captureMessage: vi.fn() };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    reportError(err, { foo: 'bar' });
    expect(consoleSpy).toHaveBeenCalled();
    expect((window as any).SENTRY.captureException).toHaveBeenCalledWith(err, { extra: { foo: 'bar' } });
    expect(fetchSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reportError prod 无 SENTRY 且 VITE_ENABLE_LOG=0 不发 fetch', () => {
    (globalThis as any).__LOGGER_DEV__ = false;
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    try { delete (window as any).SENTRY; } catch {}
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy.mockClear();
    reportError(new Error('prod err'), { a: 1 });
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reportError 无 SENTRY 时回退 POST /log 且受 VITE_ENABLE_LOG 开关控制', () => {
    try { delete (window as any).SENTRY; } catch {}
    (globalThis as any).__LOGGER_DEV__ = false;
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    fetchSpy.mockClear();
    const err = new Error('fallback');
    reportError(err, { phone: '13800001234', normal: 'ok', nested: { mail: 'a@b.com', keep: 'x' } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/log');
    const body = JSON.parse(opts.body as string);
    expect(body.level).toBe('error');
    expect(body.context.phone).not.toBe('13800001234');
    expect(body.context.phone).toContain('1234');
    expect(body.context.normal).toBe('ok');
    expect(body.context.nested.mail).not.toBe('a@b.com');
    expect(body.context.nested.keep).toBe('x');
    expect(body.stack).toBeTruthy();

    // disabled should not fetch
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    fetchSpy.mockClear();
    reportError(new Error('no log'), {});
    expect(fetchSpy).not.toHaveBeenCalled();

    // string error without Error instance -> body.error + id 敏感
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    fetchSpy.mockClear();
    reportError('string boom', { id: '123456789' });
    const body2 = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body2.error).toBe('string boom');
    expect(body2.context.id).not.toBe('123456789');
  });

  it('SENTRY captureException 抛错时静默并尝试 postLog', () => {
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    (globalThis as any).__LOGGER_DEV__ = false;
    (window as any).SENTRY = { captureException: vi.fn(() => { throw new Error('sentry fail'); }) };
    fetchSpy.mockClear();
    reportError(new Error('sentry throw'), {});
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('reportWarn 覆盖 captureMessage / captureException 回退 / postLog', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // case 1: captureMessage exists
    (globalThis as any).__LOGGER_DEV__ = true;
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    (window as any).SENTRY = { captureMessage: vi.fn(), captureException: vi.fn() };
    reportWarn('warn msg', { phone: '13800000001' });
    expect((window as any).SENTRY.captureMessage).toHaveBeenCalledWith('warn msg', 'warning', expect.objectContaining({ extra: expect.any(Object) }));
    const extra = ((window as any).SENTRY.captureMessage as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(extra.extra.phone).not.toBe('13800000001');

    // case 2: only captureException, string message
    (window as any).SENTRY = { captureException: vi.fn() };
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    reportWarn('only exception', {});
    expect((window as any).SENTRY.captureException).toHaveBeenCalledWith(expect.any(Error), expect.anything());

    // case 3: no SENTRY, fallback to postLog when enabled
    try { delete (window as any).SENTRY; } catch { (window as any).SENTRY = undefined; }
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    (globalThis as any).__LOGGER_DEV__ = false;
    fetchSpy.mockClear();
    reportWarn('post warn', { wechat: 'wxid12345' });
    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.level).toBe('warn');
    expect(body.context.wechat).not.toBe('wxid12345');

    // case 4: captureMessage throws, fallback to captureException
    (window as any).SENTRY = { captureMessage: vi.fn(() => { throw new Error('fail'); }), captureException: vi.fn() };
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    reportWarn('throw msg', {});
    expect((window as any).SENTRY.captureException).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('fetch 不存在时静默', () => {
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    (globalThis as any).__LOGGER_DEV__ = false;
    try { delete (window as any).SENTRY; } catch {}
    const origFetch = (globalThis as any).fetch;
    // @ts-expect-error -- delete readonly global fetch for test fallback
    delete (globalThis as any).fetch;
    // also delete window.fetch if exists
    try { delete (window as any).fetch; } catch {}
    vi.stubGlobal('fetch', undefined as unknown as typeof fetch);
    expect(() => reportError(new Error('no fetch'), {})).not.toThrow();
    expect(() => reportWarn('no fetch warn', {})).not.toThrow();
    vi.stubGlobal('fetch', origFetch);
  });

  it('redact 对非字符串与空字符串处理', () => {
    try { delete (window as any).SENTRY; } catch {}
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    (globalThis as any).__LOGGER_DEV__ = false;
    fetchSpy.mockClear();
    reportError(new Error('test'), { phone: '', mail: '' } as any);
    let body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.context.phone).toBe('');
    fetchSpy.mockClear();
    reportError(new Error('test2'), { phone: 12345 } as any);
    body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.context.phone).toBe(12345);
    fetchSpy.mockClear();
    reportError(new Error('test3'), { phone: 'abc' } as any);
    body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.context.phone).toBe('****');
  });

  it('isLogEnabled 与 SENTRY 缺失边界 + process.env fallback', () => {
    try { delete (window as any).SENTRY; } catch {}
    (globalThis as any).__LOGGER_ENABLE_LOG = '0';
    (globalThis as any).__LOGGER_DEV__ = false;
    fetchSpy.mockClear();
    reportError('plain string', {});
    expect(fetchSpy).not.toHaveBeenCalled();
    // process.env fallback
    (globalThis as any).__LOGGER_ENABLE_LOG = undefined;
    (process as any).env.VITE_ENABLE_LOG = '1';
    fetchSpy.mockClear();
    reportError('plain via process.env', { normal: 'v' });
    expect(fetchSpy).toHaveBeenCalled();
    delete (process as any).env.VITE_ENABLE_LOG;
    // global injection true
    (globalThis as any).__LOGGER_ENABLE_LOG = '1';
    fetchSpy.mockClear();
    reportError('plain via global', { normal: 'v' });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('reportWarn 非字符串 message 仅走 captureMessage', () => {
    (window as any).SENTRY = { captureMessage: vi.fn(), captureException: vi.fn() };
    (globalThis as any).__LOGGER_DEV__ = false;
    reportWarn(12345 as unknown as string, {});
    expect((window as any).SENTRY.captureMessage).toHaveBeenCalledWith('12345', 'warning', expect.anything());
    // captureException should not be called for non-string when captureMessage succeeds
    expect((window as any).SENTRY.captureException).not.toHaveBeenCalled();
  });
});
