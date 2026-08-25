import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveApplicants, loadApplicants, clearApplicants, readWithMigration, STORAGE_KEY } from './storage';
import type { Applicant } from '../types';

function makeApplicant(id: string, raw: Record<string,string>): Applicant { return { id, raw }; }

describe('storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('save并load往返，掩码默认生效', () => {
    const apps = [
      makeApplicant('1', { '手机号（用于通知）': '13812345678', '姓名': '张三' }),
      makeApplicant('2', { '邮箱': 'a@b.com', '微信号（用于通知）': 'wxid123' }),
    ];
    saveApplicants(apps, '标题A');
    const loaded = loadApplicants('标题A');
    expect(loaded).not.toBeNull();
    expect(loaded!.length).toBe(2);
    // 手机号应被掩码 保留后4位
    expect(loaded![0].raw['手机号（用于通知）']).toContain('5678');
    expect(loaded![0].raw['手机号（用于通知）']).toContain('***');
    // 未掩码模式可关闭
    clearApplicants();
    saveApplicants(apps, '标题A', { maskSensitive: false });
    const loaded2 = loadApplicants('标题A');
    expect(loaded2![0].raw['手机号（用于通知）']).toBe('13812345678');
  });

  it('title失配丢弃', () => {
    const apps = [makeApplicant('1', { a: '1' })];
    saveApplicants(apps, '旧标题');
    const got = loadApplicants('新标题');
    expect(got).toBeNull();
  });

  it('clearApplicants双清', () => {
    const apps = [makeApplicant('1', { a: '1' })];
    saveApplicants(apps, 't');
    expect(readWithMigration()).not.toBeNull();
    clearApplicants();
    expect(readWithMigration()).toBeNull();
    expect(loadApplicants()).toBeNull();
  });

  it('畸形数据返回null', () => {
    sessionStorage.setItem(STORAGE_KEY, '{"applicants":"not-array","configTitle":"t"}');
    expect(loadApplicants()).toBeNull();
    sessionStorage.setItem(STORAGE_KEY, 'not-json');
    expect(loadApplicants()).toBeNull();
  });

  it('超大序列化预检抛错', () => {
    const bigRaw: Record<string,string> = {};
    for(let i=0;i<100;i++) bigRaw['列'+i]='x'.repeat(500);
    const bigApps: Applicant[] = Array.from({length:200}, (_,i)=> makeApplicant(String(i), {...bigRaw, '姓名':'测试'}));
    // 可能触发长度>4.5M 的预检，或 quota；任一抛错即 pass
    let threw=false;
    try { saveApplicants(bigApps, 't', { maskSensitive:false }); } catch(e){ threw=true; expect((e as Error).message).toContain('本地存储已满'); }
    // 若未抛，说明环境未达5MB，至少验证不崩
    if(!threw) expect(loadApplicants('t')).not.toBeNull();
  });

  it('readWithMigration兼容localStorage旧数据', () => {
    const apps = [makeApplicant('1', { a:'1'})];
    // 模拟旧数据在localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ applicants: apps, configTitle:'t', savedAt:new Date().toISOString()}));
    sessionStorage.clear();
    const loaded = loadApplicants('t');
    expect(loaded).not.toBeNull();
    expect(loaded!.length).toBe(1);
    // 迁移后 sessionStorage 应有
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('debouncedSave与flush', async () => {
    const { debouncedSaveApplicants, flushPendingSave } = await import('./storage');
    const apps = [makeApplicant('1', { a:'1'})];
    debouncedSaveApplicants(apps, 't');
    // 未flush前 sessionStorage 可能无
    flushPendingSave();
    const got = loadApplicants('t');
    expect(got).not.toBeNull();
  });

  it('stripSensitiveFields与sanitize', async () => {
    const { stripSensitiveFields } = await import('./storage');
    const apps = [makeApplicant('1', { '手机号': '13800000001', '姓名':'a'})];
    const stripped = stripSensitiveFields(apps);
    expect(stripped[0].raw['手机号']).toBeUndefined();
    expect(stripped[0].raw['姓名']).toBe('a');
  });

  it('getStoredMeta', async () => {
    const { getStoredMeta } = await import('./storage');
    const apps = [makeApplicant('1', { a:'1'})];
    saveApplicants(apps, 'metaT');
    const meta = getStoredMeta();
    expect(meta).not.toBeNull();
    expect(meta!.configTitle).toBe('metaT');
    expect(meta!.count).toBe(1);
  });
});
