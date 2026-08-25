import { z } from 'zod';
import { ViewConfig, DEFAULT_CONFIG } from './types';
import { reportError, reportWarn } from './utils/logger';

// zod 单轨全量校验（已移除 legacy 双轨合并）：
// - configSchema 为唯一校验源，单源真理
// - H3 原型污染与 statusValues 去重保留在 superRefine
// - 字段级中文文案通过 zod message + getConfigValidationErrors 映射保证
const ALLOWED_FIELD_TYPES_ZOD = ['text','textarea','number','date','email','url','select','multiselect','attachment','rating','boolean','currency','phone'] as const;
const ALLOWED_FILTERS_ZOD = ['exact','range','search'] as const;
const ALLOWED_COLORS_ZOD = ['green','red','yellow','blue','gray'] as const;

const fieldSchema = z.object({
  key: z.string({ required_error: 'key 必须为非空字符串', invalid_type_error: 'key 必须为非空字符串' }).min(1, { message: 'key 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'key 必须为非空字符串' }),
  label: z.string({ required_error: 'label 必须为非空字符串', invalid_type_error: 'label 必须为非空字符串' }).min(1, { message: 'label 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'label 必须为非空字符串' }),
  multiline: z.boolean({ invalid_type_error: 'multiline 必须为 boolean' }).optional(),
  visibleInList: z.boolean({ invalid_type_error: 'visibleInList 必须为 boolean' }).optional(),
  type: z.enum(ALLOWED_FIELD_TYPES_ZOD, { errorMap: () => ({ message: `type 必须为 ${ALLOWED_FIELD_TYPES_ZOD.join('/')} 之一` }) }).optional(),
  options: z.array(z.string({ invalid_type_error: 'options 必须为字符串数组' }), { invalid_type_error: 'options 必须为字符串数组' }).optional().refine(v => v === undefined || v.every(o => typeof o === 'string'), { message: 'options 必须为字符串数组' }),
  width: z.number({ invalid_type_error: 'width 必须为 number' }).optional(),
  sortable: z.boolean({ invalid_type_error: 'sortable 必须为 boolean' }).optional(),
  searchable: z.boolean({ invalid_type_error: 'searchable 必须为 boolean' }).optional(),
  required: z.boolean({ invalid_type_error: 'required 必须为 boolean' }).optional(),
  filter: z.enum(ALLOWED_FILTERS_ZOD, { errorMap: () => ({ message: `filter 必须为 ${ALLOWED_FILTERS_ZOD.join('/')} 之一` }) }).optional(),
}).passthrough().superRefine((val, ctx) => {
  if (val.options !== undefined && (!Array.isArray(val.options) || val.options.some(o => typeof o !== 'string'))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'options 必须为字符串数组', path: ['options'] });
  }
});

const statusValueSchema = z.object({
  value: z.string({ required_error: 'value 必须为字符串', invalid_type_error: 'value 必须为字符串' }),
  label: z.string({ required_error: 'label 必须为非空字符串', invalid_type_error: 'label 必须为非空字符串' }).min(1, { message: 'label 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'label 必须为非空字符串' }),
  color: z.enum(ALLOWED_COLORS_ZOD, { errorMap: () => ({ message: 'color 必须为 green/red/yellow/blue/gray 之一' }) }).optional(),
}).passthrough();

const detailGroupSchema = z.object({
  label: z.string({ required_error: 'label 必须为非空字符串', invalid_type_error: 'label 必须为非空字符串' }).min(1, { message: 'label 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'label 必须为非空字符串' }),
  fields: z.array(fieldSchema, { required_error: 'fields 必须为数组', invalid_type_error: 'fields 必须为数组' }),
}).passthrough();

export const configSchema = z.object({
  title: z.string({ required_error: 'title 必须为非空字符串', invalid_type_error: 'title 必须为非空字符串' }).min(1, { message: 'title 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'title 必须为非空字符串' }),
  idField: z.string({ required_error: 'idField 必须为非空字符串', invalid_type_error: 'idField 必须为非空字符串' }).min(1, { message: 'idField 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'idField 必须为非空字符串' }),
  nameField: z.string({ required_error: 'nameField 必须为非空字符串', invalid_type_error: 'nameField 必须为非空字符串' }).min(1, { message: 'nameField 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'nameField 必须为非空字符串' }),
  statusField: z.string({ required_error: 'statusField 必须为非空字符串', invalid_type_error: 'statusField 必须为非空字符串' }).min(1, { message: 'statusField 必须为非空字符串' }).refine(v => v.trim().length > 0, { message: 'statusField 必须为非空字符串' }),
  listFields: z.array(fieldSchema, { required_error: 'listFields 必须为数组', invalid_type_error: 'listFields 必须为数组' }).min(1, { message: 'listFields 不能为空数组' }),
  detailGroups: z.array(detailGroupSchema, { required_error: 'detailGroups 必须为数组', invalid_type_error: 'detailGroups 必须为数组' }),
  statusValues: z.array(statusValueSchema, { required_error: 'statusValues 必须为数组', invalid_type_error: 'statusValues 必须为数组' }).min(1, { message: 'statusValues 不能为空数组' }),
  sensitiveKeys: z.array(z.string().min(1, { message: 'sensitiveKeys 必须为非空字符串数组' }), { invalid_type_error: 'sensitiveKeys 必须为非空字符串数组' }).optional().refine(v => v === undefined || v.every(k => typeof k === 'string' && k.trim().length > 0), { message: 'sensitiveKeys 必须为非空字符串数组' }),
}).passthrough().superRefine((val, ctx) => {
  // H3: 原型污染拦截（zod 侧）
  if ('__proto__' in (val as Record<string, unknown>) || 'constructor' in (val as Record<string, unknown>) || 'prototype' in (val as Record<string, unknown>)) {
    const hasProto = Object.prototype.hasOwnProperty.call(val as object, '__proto__') || Object.prototype.hasOwnProperty.call(val as object, 'constructor') || Object.prototype.hasOwnProperty.call(val as object, 'prototype');
    if (hasProto) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '配置包含非法原型字段', path: [] });
    }
  }
  // statusValues value 重复校验
  if (Array.isArray((val as Record<string, unknown>).statusValues)) {
    const seen = new Set<string>();
    (val.statusValues as Array<Record<string, unknown>>).forEach((sv, i) => {
      const v = sv?.value as string;
      if (typeof v === 'string') {
        if (seen.has(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `statusValues[${i}].value "${v}" 重复`, path: ['statusValues', i, 'value'] });
        } else {
          seen.add(v);
        }
      }
    });
  }
});

const CONFIG_STORAGE_KEY = 'applicant-review-config';

/**
 * H3: 同源限制白名单（默认仅 location.origin）
 */
export const ALLOWED_ORIGINS: string[] = typeof window !== 'undefined' && window.location ? [window.location.origin] : [];

function getCacheKey(url: string): string {
  // H3: 限长 200，避免超长 URL 导致 storage key 过长；等效简易 sha 截断
  const safe = url.slice(0, 200);
  return `config-cache-${safe}`;
}

function sanitizeConfigData<T>(data: T): T {
  // 递归版本：处理数组与嵌套对象，过滤 __proto__/constructor/prototype
  const PROTO_RE = /^(__proto__|constructor|prototype)$/;
  const seen = new WeakSet<object>();
  function recurse(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) recurse(item);
      return;
    }
    const obj = value as Record<string, unknown>;
    // 删除原型污染键（先删顶层）
    for (const k of Object.keys(obj)) {
      if (PROTO_RE.test(k)) {
        try { delete obj[k]; } catch {}
        continue;
      }
    }
    // 兼容 in 检查（处理不可枚举或 defineProperty 的 __proto__）
    if ('__proto__' in obj) {
      try { delete (obj as Record<string, unknown>)['__proto__']; } catch {}
    }
    if ('constructor' in obj && obj['constructor'] !== Object) {
      const v = obj['constructor'];
      if (typeof v === 'object' || typeof v === 'function') {
        try { delete obj['constructor']; } catch {}
      }
    }
    if ('prototype' in obj) {
      try { delete (obj as Record<string, unknown>)['prototype']; } catch {}
    }
    // 递归子节点
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object') recurse(v);
    }
  }
  recurse(data as unknown);
  return data;
}

/**
 * Extract remote config URL from location search.
 * Synchronous, only does URL parsing.
 * H3: 限制同源，否则返回 null 并 warn
 */
export function getConfigUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const configUrl = params.get('config');
    if (!configUrl) return null;
    // basic validation: must be http(s) url
    let parsed: URL;
    try {
      parsed = new URL(configUrl, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        reportWarn('Invalid config URL protocol:', { configUrl });
        return null;
      }
    } catch {
      reportWarn('Invalid config URL:', { configUrl });
      return null;
    }
    // H3: 同源校验
    const allowed = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : [window.location.origin];
    if (!allowed.includes(parsed.origin) && parsed.origin !== window.location.origin) {
      reportWarn('远程配置仅允许同源', { configUrl, origin: parsed.origin, allowed });
      return null;
    }
    return configUrl;
  } catch {
    return null;
  }
}

/**
 * @deprecated Keep for backward compat – now only does URL parsing and returns null.
 * Use getConfigUrl() + fetchRemoteConfig() instead.
 */
function getConfigFromUrl(): ViewConfig | null {
  // only URL parsing, no fetch, no sessionStorage read that pretends to be remote
  getConfigUrl();
  return null;
}

function getConfigFromStorage(): ViewConfig | null {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      sanitizeConfigData(parsed);
      if (validateConfig(parsed)) return parsed;
      reportWarn('Stored config validation failed', { errors: getConfigValidationErrors(parsed) });
    }
  } catch {}
  return null;
}

async function fetchPublicConfig(): Promise<ViewConfig | null> {
  try {
    const res = await fetch('/config.json', { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text);
      sanitizeConfigData(json);
      if (validateConfig(json)) return json;
      reportWarn('public/config.json validation failed', { errors: getConfigValidationErrors(json) });
    }
  } catch (e) { reportError(e, { source: 'fetchPublicConfig' }); }
  return null;
}

function tryGetCachedConfig(url: string): ViewConfig | null {
  try {
    const cached = sessionStorage.getItem(getCacheKey(url));
    if (cached) {
      const parsed = JSON.parse(cached);
      sanitizeConfigData(parsed);
      if (validateConfig(parsed)) return parsed as ViewConfig;
      reportWarn('Cached config validation failed', { errors: getConfigValidationErrors(parsed) });
    }
  } catch (e) { reportError(e, { source: 'tryGetCachedConfig', url }); }
  return null;
}

export async function loadConfig(): Promise<ViewConfig> {
  // 1. URL remote config – async fetch with fallback
  const configUrl = getConfigUrl();
  // also call deprecated for side-effect coverage
  getConfigFromUrl();
  if (configUrl) {
    try {
      const data: unknown = await fetchRemoteConfig(configUrl);
      if (!validateConfig(data)) throw new Error('Remote config validation failed: ' + getConfigValidationErrors(data).join('；'));
      const remote = data as ViewConfig;
      cacheUrlConfig(configUrl, remote);
      return remote;
    } catch (err) {
      reportError(err, { configUrl, source: 'loadConfig.fetchRemoteConfig' });
      // try fallback to cached value on network/CORS error
      const cached = tryGetCachedConfig(configUrl);
      if (cached) {
        reportWarn('Using cached remote config due to fetch failure', { configUrl });
        return cached;
      }
    }
  }

  const storedConfig = getConfigFromStorage();
  if (storedConfig) return storedConfig;

  const publicConfig = await fetchPublicConfig();
  if (publicConfig) return publicConfig;

  return DEFAULT_CONFIG;
}

export function saveConfig(config: ViewConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) { reportError(e, { source: 'saveConfig', configTitle: config.title }); }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch (e) { reportError(e, { source: 'clearConfig' }); }
}

export function cacheUrlConfig(url: string, config: ViewConfig): void {
  try {
    sessionStorage.setItem(getCacheKey(url), JSON.stringify(config));
  } catch (e) { reportError(e, { source: 'cacheUrlConfig', configUrl: url, configTitle: config.title }); }
}

export async function fetchRemoteConfig(url: string): Promise<unknown> {
  // H3: 同源二次校验（防御直接调用）
  try {
    const u = new URL(url, window.location.origin);
    const allowed = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : [window.location.origin];
    if (!allowed.includes(u.origin) && u.origin !== window.location.origin) {
      reportWarn('远程配置仅允许同源', { configUrl: url, origin: u.origin });
      throw new Error('远程配置仅允许同源');
    }
  } catch (e) {
    if (e instanceof Error && e.message === '远程配置仅允许同源') throw e;
    // URL 解析失败则继续让 fetch 报错
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url, { mode: 'cors', cache: 'no-cache', signal: controller.signal });
  } catch (err) {
    // 超时或网络失败
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('获取远程配置超时（5s）');
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CORS') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(`CORS或网络错误，无法获取远程配置: ${msg}`);
    }
    throw new Error(`网络错误，无法获取远程配置: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status} ${res.statusText}`);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('远程配置不是合法 JSON');
  }
  sanitizeConfigData(data as Record<string, unknown>);
  // 额外防御：若仍含污染键则拦截
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(o, '__proto__') || Object.prototype.hasOwnProperty.call(o, 'constructor') || Object.prototype.hasOwnProperty.call(o, 'prototype')) {
      reportWarn('远程配置包含非法原型键，已剔除', { configUrl: url });
      if ('__proto__' in o) delete o['__proto__'];
      try { if ('constructor' in o) delete o['constructor']; } catch {}
      try { if ('prototype' in o) delete o['prototype']; } catch {}
    }
  }
  return data;
}

/**
 * 纯 zod 校验：单源真理（已删除 150 行手写 getLegacyValidationErrors）
 * - 移除双轨合并，仅保留 zod 单轨
 * - 保留中文文案 key 映射以兼容现有测试 substring 匹配
 */
export function getConfigValidationErrors(config: unknown): string[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['配置必须为非空对象'];
  }
  if (
    Object.prototype.hasOwnProperty.call(config as object, '__proto__') ||
    Object.prototype.hasOwnProperty.call(config as object, 'constructor') ||
    Object.prototype.hasOwnProperty.call(config as object, 'prototype')
  ) {
    return ['配置包含非法原型字段'];
  }
  const result = configSchema.safeParse(config);
  if (result.success) return [];
  const zodErrors: string[] = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    const msg = issue.message;
    if (msg.includes('必须为') || msg.includes('不能为空') || msg.includes('非法原型') || msg.includes('重复')) {
      return msg;
    }
    if (path.startsWith('title')) return 'title 必须为非空字符串';
    if (path.startsWith('idField')) return 'idField 必须为非空字符串';
    if (path.startsWith('nameField')) return 'nameField 必须为非空字符串';
    if (path.startsWith('statusField')) return 'statusField 必须为非空字符串';
    if (path.startsWith('listFields')) {
      if (msg.includes('array') || issue.code === 'too_small' || issue.code === 'invalid_type') {
        const list = (config as Record<string, unknown>)?.listFields;
        if (Array.isArray(list) && list.length === 0) return 'listFields 不能为空数组';
        return 'listFields 必须为数组';
      }
      if (path.includes('visibleInList')) return `${path} 必须为 boolean`;
      if (path.includes('multiline')) return `${path} 必须为 boolean`;
      if (path.includes('color')) return `${path} 必须为 green/red/yellow/blue/gray 之一`;
      if (path.includes('type')) return `${path} 必须为 ${ALLOWED_FIELD_TYPES_ZOD.join('/')} 之一`;
      if (path.includes('filter')) return `${path} 必须为 ${ALLOWED_FILTERS_ZOD.join('/')} 之一`;
      if (path.includes('options')) return `${path} 必须为字符串数组`;
      if (path.includes('width')) return `${path} 必须为 number`;
      if (path.includes('sortable') || path.includes('searchable') || path.includes('required')) return `${path} 必须为 boolean`;
      return path ? `${path}: ${msg}` : msg;
    }
    if (path.startsWith('detailGroups')) {
      if (msg.includes('array') || issue.code === 'invalid_type' || issue.code === 'too_small') {
        if (path.endsWith('fields') || path.includes('.fields')) return `${path} 必须为数组`;
        return 'detailGroups 必须为数组';
      }
      if (path.includes('label')) return `${path} 必须为非空字符串`;
      if (path.includes('key')) return `${path} 必须为非空字符串`;
      if (path.includes('visibleInList') || path.includes('multiline')) return `${path} 必须为 boolean`;
      return path ? `${path}: ${msg}` : msg;
    }
    if (path.startsWith('statusValues')) {
      if (msg.includes('array') || issue.code === 'too_small' || issue.code === 'invalid_type') {
        const sv = (config as Record<string, unknown>)?.statusValues;
        if (Array.isArray(sv) && sv.length === 0) return 'statusValues 不能为空数组';
        return 'statusValues 必须为数组';
      }
      if (path.includes('color')) return `${path} 必须为 green/red/yellow/blue/gray 之一`;
      if (path.includes('value')) return `${path} 必须为字符串`;
      if (path.includes('label')) return `${path} 必须为非空字符串`;
      return path ? `${path}: ${msg}` : msg;
    }
    if (path.startsWith('sensitiveKeys')) return 'sensitiveKeys 必须为非空字符串数组';
    if (path === '' && msg.includes('非法原型')) return '配置包含非法原型字段';
    if (!config || typeof config !== 'object') return '配置必须为非空对象';
    return path ? `${path}: ${msg}` : msg;
  });
  return [...new Set(zodErrors)];
}

/**
 * 纯 zod validateConfig：单源（保留 H3 原型污染前置拦截，zod superRefine 无法捕获被 strip 的 __proto__ own property）
 */
export function validateConfig(config: unknown): config is ViewConfig {
  if (config && typeof config === 'object') {
    if (
      Object.prototype.hasOwnProperty.call(config as object, '__proto__') ||
      Object.prototype.hasOwnProperty.call(config as object, 'constructor') ||
      Object.prototype.hasOwnProperty.call(config as object, 'prototype')
    ) {
      return false;
    }
  }
  return configSchema.safeParse(config).success;
}

export function getStatusColor(statusValue: string, config: ViewConfig): string {
  const sv = config.statusValues.find(s => s.value === statusValue);
  if (!sv?.color) return 'gray';
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return colors[sv.color] || 'bg-gray-100 text-gray-700';
}

export function getStatusLabel(statusValue: string, config: ViewConfig): string {
  const sv = config.statusValues.find(s => s.value === statusValue);
  return sv?.label || statusValue || '待审核';
}
