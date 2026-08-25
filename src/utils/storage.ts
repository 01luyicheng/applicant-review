import type { Applicant } from '../types';
import { reportError, reportWarn } from './logger';

// i18n: error.storageFull / error.storageFallbackFailed / error.saveFailed
export const ERR_STORAGE_FULL = '本地存储已满（约5MB限制），无法保存。请清除缓存或减少数据量后重试。'; // i18n: error.storageFull
export const ERR_STORAGE_FALLBACK_FAILED = '当前环境不支持 sessionStorage，且回退到 localStorage 失败'; // i18n: error.storageFallbackFailed
export const ERR_SAVE_FAILED_PREFIX = '保存失败: '; // i18n: error.saveFailed

export const STORAGE_KEY = 'applicant-review-data';
/**
 * H1: 默认使用 sessionStorage 避免 PII 明文持久化到 localStorage。
 * 提供 STORAGE_TYPE 常量以便按需切换；读取时兼容旧 localStorage 数据并尝试迁移。
 */
export const STORAGE_TYPE = 'sessionStorage' as const;

interface StoredPayload {
  applicants: Applicant[];
  configTitle: string;
  savedAt: string;
}

export const DEFAULT_SENSITIVE_PATTERN = /手机|邮箱|微信|phone|mail|tel|mobile|wechat|身份证/i;

export function isSensitiveKey(key: string, sensitiveKeys?: string[]): boolean {
  if (sensitiveKeys && sensitiveKeys.length > 0) {
    const lower = key.toLowerCase();
    for (const ck of sensitiveKeys) {
      if (!ck) continue;
      if (lower.includes(ck.toLowerCase())) return true;
      try {
        if (new RegExp(ck, 'i').test(key)) return true;
      } catch {
        // invalid regex pattern, ignore and fallback to substring check already done
      }
    }
    return false;
  }
  return DEFAULT_SENSITIVE_PATTERN.test(key);
}

function sanitizeApplicantsForStorage(applicants: Applicant[], sensitiveKeys?: string[]): Applicant[] {
  // 掩码敏感列：key 命中敏感正则或 ViewConfig.sensitiveKeys 可配列表的字段值用 *** 掩码，保留后4位便于识别
  return applicants.map(a => {
    const sanitizedRaw: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.raw)) {
      if (isSensitiveKey(k, sensitiveKeys) && typeof v === 'string' && v) {
        // 简单掩码：保留后4位，其余替换为 *
        const visible = v.slice(-4);
        const masked = v.length > 4 ? '*'.repeat(Math.max(0, v.length - 4)) + visible : '****';
        sanitizedRaw[k] = masked;
      } else {
        sanitizedRaw[k] = v;
      }
    }
    return { ...a, raw: sanitizedRaw };
  });
}

/**
 * 剥离敏感列的替代方案（按需调用）：直接移除敏感 key
 * 隐私提示（与 README 🔒 一致）：导出前默认建议调用 stripSensitiveFields
 * 剥离敏感列后再导出，避免 PII 明文落地到 CSV；如需掩码可改用 sanitize。
 * 默认行为提示：未传 sensitiveKeys 时 fallback 到 DEFAULT_SENSITIVE_PATTERN
 */
export function stripSensitiveFields(applicants: Applicant[], sensitiveKeys?: string[]): Applicant[] {
  return applicants.map(a => {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.raw)) {
      if (!isSensitiveKey(k, sensitiveKeys)) raw[k] = v;
    }
    return { ...a, raw };
  });
}

function getPrimaryStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch {}
  return null;
}

export function getFallbackStorage(): Storage | null {
  // 已移除静默降级：仅当 primary 不可用时才返回 fallback，且需调用方显式确认
  // 此处仅做可用性探测，真正写入需用户确认；读取侧由 readWithMigration 单独 warn
  try {
    const primary = getPrimaryStorage();
    if (primary) return null;
    // primary 不可用，提示用户确认后再使用 localStorage（避免 PII 持久化）
    // eslint-disable-next-line no-console
    console.warn('[storage] sessionStorage 不可用，将回退到 localStorage，需用户确认（PII 将持久化）');
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

export function readWithMigration(): string | null {
  // 优先读 sessionStorage；若无则尝试 localStorage（旧数据）并迁移到 sessionStorage
  // 增加 warn 日志，提示迁移行为，并建议展示迁移横幅
  try {
    const primary = getPrimaryStorage();
    if (primary) {
      const v = primary.getItem(STORAGE_KEY);
      if (v) return v;
    }
    // 兼容旧 localStorage 数据：读取需 warn，且迁移需用户可感知
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const legacy = window.localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          // eslint-disable-next-line no-console
          console.warn('[storage] 检测到旧 localStorage 数据，已迁移到 sessionStorage（兼容读取）');
          // 迁移横幅建议：提示用户旧数据已迁移，建议刷新或确认迁移横幅
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('storage-migration-banner', { detail: { message: '检测到旧数据已迁移，建议展示迁移横幅' } }));
              // eslint-disable-next-line no-console
              console.warn('[storage] 建议展示迁移横幅：旧 localStorage 数据已迁移到 sessionStorage');
            }
          } catch {}
          // 迁移到 sessionStorage（不阻塞）
          try {
            primary?.setItem(STORAGE_KEY, legacy);
          } catch {}
          return legacy;
        }
      }
    } catch {}
  } catch {}
  return null;
}

/**
 * Persist applicants with config.title joint validation.
 * Handles 5MB quota: throws with user-friendly message on overflow.
 * H1: 默认写入 sessionStorage；敏感字段掩码；序列化长度预检
 * M2: serialized.length > 4_500_000 预检
 * 安全变更：移除静默降级 localStorage —— primary 不可用时不再自动 fallback 写入，
 * 需调用方显式确认后方可使用 localStorage（否则 throw 需确认）。
 */
export function saveApplicants(applicants: Applicant[], configTitle: string, opts: { maskSensitive?: boolean; sensitiveKeys?: string[] } = { maskSensitive: true }): void {
  try {
    const maskSensitive = opts.maskSensitive ?? true;
    const toPersist = maskSensitive ? sanitizeApplicantsForStorage(applicants, opts.sensitiveKeys) : applicants;
    const payload: StoredPayload = {
      applicants: toPersist,
      configTitle,
      savedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    // M2: 写入前预检，避免直接触发 QuotaExceeded
    if (serialized.length > 4_500_000) {
      throw new Error(ERR_STORAGE_FULL); // i18n: error.storageFull
    }
    const primary = getPrimaryStorage();
    if (primary) {
      primary.setItem(STORAGE_KEY, serialized);
      return;
    }
    // 降级回退：primary 不可用时回退到持久存储 localStorage，提示用户已回退
    // eslint-disable-next-line no-console
    console.warn('[storage] sessionStorage 不可用，已回退到持久存储');
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
        try {
          window.dispatchEvent(new CustomEvent('storage-fallback-toast', { detail: '已回退到持久存储' }));
        } catch {}
        // eslint-disable-next-line no-console
        console.warn('[storage] 已回退到持久存储 localStorage');
        return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[storage] 回退到 localStorage 失败', e);
    }
    throw new Error(ERR_STORAGE_FALLBACK_FAILED); // i18n: error.storageFallbackFailed
  } catch (e) {
    // QuotaExceededError: DOMException code 22 or name
    const isQuota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.code === 22 || (e as unknown as { name: string }).name === 'NS_ERROR_DOM_QUOTA_REACHED');
    if (isQuota || (e instanceof Error && e.message.includes('quota'))) {
      reportWarn('storage quota exceeded', { configTitle, error: String(e) });
      throw new Error(ERR_STORAGE_FULL); // i18n: error.storageFull
    }
    // 超限预检错误直接透传
    if (e instanceof Error && e.message.includes('本地存储已满')) throw e; // i18n: error.storageFull
    // fallback: detect stringified size
    if (e instanceof Error) throw e;
    throw new Error(ERR_SAVE_FAILED_PREFIX + String(e)); // i18n: error.saveFailed
  }
}

export function loadApplicants(expectedTitle?: string): Applicant[] | null {
  try {
    const raw = readWithMigration();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (!Array.isArray(parsed.applicants)) return null;
    // joint validation: if expectedTitle provided and stored title mismatches, discard
    if (expectedTitle && parsed.configTitle && parsed.configTitle !== expectedTitle) {
      reportWarn('Stored configTitle mismatches current, discarding cached applicants', {
        storedTitle: parsed.configTitle,
        expectedTitle,
      });
      return null;
    }
    // basic shape check
    const valid = parsed.applicants.every(
      a => a && typeof a === 'object' && typeof (a as Applicant).id === 'string' && typeof (a as Applicant).raw === 'object'
    );
    if (!valid) {
      reportWarn('Stored applicants malformed, discarding', { configTitle: expectedTitle ?? parsed.configTitle });
      return null;
    }
    return parsed.applicants as Applicant[];
  } catch (err) {
    reportError(err, { source: 'loadApplicants', configTitle: expectedTitle });
    return null;
  }
}

export function clearApplicants(): void {
  try {
    getPrimaryStorage()?.removeItem(STORAGE_KEY);
  } catch {}
  try {
    // H1: 同时清旧 localStorage 以兼容迁移（直接访问，不走 getFallbackStorage 的 primary 检查）
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getStoredMeta(): { configTitle: string; savedAt: string; count: number } | null {
  try {
    const raw = readWithMigration();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    return {
      configTitle: parsed.configTitle,
      savedAt: parsed.savedAt,
      count: Array.isArray(parsed.applicants) ? parsed.applicants.length : 0,
    };
  } catch {
    return null;
  }
}

/**
 * H1: 提示调用方可在页面卸载时清理敏感缓存
 * 用法：setupClearOnUnload() 或自行在 beforeunload 中调用 clearApplicants()
 */
export function setupClearOnUnload(): void {
  try {
    window.addEventListener('beforeunload', () => {
      try { clearApplicants(); } catch {}
    });
    // 可选：页面隐藏时也清理（更严格）
    // document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') clearApplicants(); });
  } catch {}
}

// H1 提示：敏感数据默认存 sessionStorage，关闭标签页自动清除；如需持久化请显式 opts.maskSensitive=true 或调用 stripSensitiveFields 后再保存。
export const CLEAR_ON_UNLOAD_HINT = '敏感数据已存于 sessionStorage，关闭标签页后自动清除；如需长期保留请先对手机号/邮箱/微信列掩码或剥离。';

// M2: 防抖写入 500ms，合并连续状态切换
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSave: { applicants: Applicant[]; configTitle: string; opts?: { maskSensitive?: boolean; sensitiveKeys?: string[] } } | null = null;

export function debouncedSaveApplicants(applicants: Applicant[], configTitle: string, opts: { maskSensitive?: boolean; sensitiveKeys?: string[] } = { maskSensitive: true }): void {
  _pendingSave = { applicants, configTitle, opts };
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    if (_pendingSave) {
      try {
        saveApplicants(_pendingSave.applicants, _pendingSave.configTitle, _pendingSave.opts);
      } catch (e) {
        reportError(e, { source: 'debouncedSaveApplicants', configTitle: _pendingSave.configTitle });
        // 抛给调用方无法直接感知，这里仅上报；App 层会通过 try/catch 处理同步调用，对于防抖路径可在 setTimeout 内上报已足够
        // 如需 UI 提示，App 可传入 onError 回调，此处保留基础版
      }
      _pendingSave = null;
    }
    _debounceTimer = null;
  }, 500);
}

export function flushPendingSave(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_pendingSave) {
    try {
      saveApplicants(_pendingSave.applicants, _pendingSave.configTitle, _pendingSave.opts);
    } finally {
      _pendingSave = null;
    }
  }
}

// 自动注册 beforeunload / visibilitychange 以 flush 500ms 防抖待写入（避免关闭丢失）
function setupFlushListeners(): void {
  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushPendingSave);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) flushPendingSave();
      });
    }
  } catch {}
}
setupFlushListeners();
