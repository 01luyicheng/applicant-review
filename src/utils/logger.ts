/* eslint-disable no-console */
/**
 * 轻量可观测封装（不引 Sentry 依赖）
 * - dev 下才 console.*，生产仅上报
 * - 若 window.SENTRY 存在则优先上报，否则 POST /log（静默失败）
 * - 隐私口径（与 README 🔒 隐私与数据说明一致）：
 *   本地处理，不上传服务器。POST /log 默认禁用，需显式
 *   import.meta.env.VITE_ENABLE_LOG === '1' 才发请求；
 *   所有上报路径均对敏感 key 做 redact 掩码。
 */
type SentryLike = {
  captureException?: (err: unknown, ctx?: unknown) => void;
  captureMessage?: (msg: string, level?: string, ctx?: unknown) => void;
};

declare global {
  interface Window {
    SENTRY?: SentryLike;
  }
}

function isDev(): boolean {
  try {
    // 测试覆盖可通过 globalThis.__LOGGER_DEV__ 注入 dev/prod 分支（不影响生产）
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, unknown>).__LOGGER_DEV__ !== undefined) {
      return Boolean((globalThis as unknown as Record<string, unknown>).__LOGGER_DEV__);
    }
    // vite: import.meta.env.DEV
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

function tryGetSentry(): SentryLike | undefined {
  try {
    if (typeof window !== 'undefined' && window.SENTRY) return window.SENTRY;
  } catch {}
  return undefined;
}

function isLogEnabled(): boolean {
  try {
    // 测试注入：globalThis.__LOGGER_ENABLE_LOG === '1' 时启用（便于覆盖 VITE_ENABLE_LOG 开关分支）
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, unknown>).__LOGGER_ENABLE_LOG !== undefined) {
      return (globalThis as unknown as Record<string, unknown>).__LOGGER_ENABLE_LOG === '1';
    }
    if ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ENABLE_LOG === '1') return true;
    // fallback：process.env（vitest stubEnv 场景）
    if (typeof process !== 'undefined' && (process as unknown as { env: Record<string, string> }).env?.VITE_ENABLE_LOG === '1') return true;
    return false;
  } catch {
    return false;
  }
}

// 敏感 key 掩码：与 storage 保持一致，额外覆盖 id（避免学号/工号等标识泄露）
const SENSITIVE_LOG_KEY_RE = /手机|邮箱|微信|phone|mail|tel|mobile|wechat|id/i;

function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && value) {
    const visible = value.slice(-4);
    return value.length > 4 ? '*'.repeat(Math.max(0, value.length - 4)) + visible : '****';
  }
  return value;
}

function redactContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return context;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (SENSITIVE_LOG_KEY_RE.test(k)) {
      out[k] = redactValue(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      // shallow recurse one level for nested object contexts
      const nested = v as Record<string, unknown>;
      const redactedNested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(nested)) {
        redactedNested[nk] = SENSITIVE_LOG_KEY_RE.test(nk) ? redactValue(nv) : nv;
      }
      out[k] = redactedNested;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function postLog(level: 'error' | 'warn', message: string, err?: unknown, context?: Record<string, unknown>): void {
  try {
    if (!isLogEnabled()) return;
    if (typeof fetch === 'undefined') return;
    const safeContext = redactContext(context);
    const body: Record<string, unknown> = {
      level,
      message,
      context: safeContext,
      timestamp: new Date().toISOString(),
    };
    if (err instanceof Error) {
      body.stack = err.stack;
      // message 已含，此处追加 err 信息以便检索
      if (!body.message || body.message === String(err)) body.message = err.message;
    } else if (err !== undefined) {
      body.error = String(err);
    }
    fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {}
}

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (isDev()) {
    console.error(err, context ?? '');
  }
  const safeContext = redactContext(context);
  const sentry = tryGetSentry();
  if (sentry?.captureException) {
    try {
      sentry.captureException(err, safeContext ? { extra: safeContext } : undefined);
      return;
    } catch {}
  }
  // 无 SENTRY 时回退到 /log（静默；默认禁用需 VITE_ENABLE_LOG=1）
  const msg = err instanceof Error ? err.message : String(err);
  postLog('error', msg, err, safeContext);
}

export function reportWarn(message: unknown, context?: Record<string, unknown>): void {
  if (isDev()) {
    console.warn(message, context ?? '');
  }
  const safeContext = redactContext(context);
  const sentry = tryGetSentry();
  if (sentry?.captureMessage) {
    try {
      sentry.captureMessage(String(message), 'warning', safeContext ? { extra: safeContext } : undefined);
      return;
    } catch {}
  }
  // 兼容仅有 captureException 的 SENTRY 实现
  if (sentry?.captureException && typeof message === 'string') {
    try {
      sentry.captureException(new Error(message), safeContext ? { extra: safeContext } : undefined);
      return;
    } catch {}
  }
  postLog('warn', String(message), undefined, safeContext);
}
