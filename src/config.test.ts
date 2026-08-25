import { describe, it, expect } from 'vitest';
import { validateConfig, getConfigValidationErrors, getStatusColor, getStatusLabel } from './config';
import { DEFAULT_CONFIG } from './types';

describe('validateConfig', () => {
  it('空对象应校验失败', () => {
    const errors = getConfigValidationErrors({});
    expect(validateConfig({})).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('|')).toContain('title');
  });

  it('非法color应校验失败', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
    const statusValues = bad.statusValues as Array<Record<string, unknown>>;
    statusValues[0] = { ...statusValues[0], color: 'purple' };
    const errors = getConfigValidationErrors(bad);
    expect(validateConfig(bad)).toBe(false);
    expect(errors.some(e => e.includes('color'))).toBe(true);
    expect(errors.join('|')).toContain('green/red/yellow/blue/gray');
  });

  it('重复value应校验失败', () => {
    const dup = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
    const statusValues = dup.statusValues as Array<Record<string, unknown>>;
    statusValues[1] = { ...statusValues[1], value: statusValues[0].value };
    const errors = getConfigValidationErrors(dup);
    expect(validateConfig(dup)).toBe(false);
    expect(errors.some(e => e.includes('重复'))).toBe(true);
  });

  it('DEFAULT_CONFIG应通过', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toBe(true);
    expect(getConfigValidationErrors(DEFAULT_CONFIG).length).toBe(0);
  });

  it('listFields为空失败', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as Record<string,unknown>;
    (bad as any).listFields = [];
    expect(validateConfig(bad)).toBe(false);
    expect(getConfigValidationErrors(bad).join('|')).toContain('listFields');
  });

  it('detailGroups fields非数组失败', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as Record<string,unknown>;
    (bad as any).detailGroups[0].fields = 'not-array';
    expect(validateConfig(bad)).toBe(false);
  });

  it('statusValues空数组失败', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as Record<string,unknown>;
    (bad as any).statusValues = [];
    expect(validateConfig(bad)).toBe(false);
  });

  it('visibleInList类型错误', () => {
    const bad = structuredClone(DEFAULT_CONFIG) as unknown as Record<string,unknown>;
    (bad as any).listFields[0].visibleInList = 'yes';
    expect(validateConfig(bad)).toBe(false);
    expect(getConfigValidationErrors(bad).some(e=>e.includes('visibleInList'))).toBe(true);
  });

  it('原型污染拦截', () => {
    // hasOwnProperty 拦截需直接构造
    const tricky: any = structuredClone(DEFAULT_CONFIG);
    Object.defineProperty(tricky, '__proto__', { value:{}, enumerable:true, configurable:true, writable:true });
    expect(validateConfig(tricky)).toBe(false);
    expect(getConfigValidationErrors(tricky).join('|')).toContain('非法原型');
  });

  it('getStatusColor/getStatusLabel', () => {
    expect(getStatusColor('通过', DEFAULT_CONFIG)).toContain('green');
    expect(getStatusColor('不存在', DEFAULT_CONFIG)).toBe('gray');
    expect(getStatusLabel('通过', DEFAULT_CONFIG)).toBe('通过');
    expect(getStatusLabel('', DEFAULT_CONFIG)).toBe('待审核');
  });

  it('非对象输入', () => {
    expect(getConfigValidationErrors(null).join('|')).toContain('非空对象');
    expect(getConfigValidationErrors('string' as any).join('|')).toContain('非空对象');
  });
});
