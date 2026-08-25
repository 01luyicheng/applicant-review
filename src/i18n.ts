import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

export type Locale = 'zh' | 'en';
export type Messages = Record<string, string>;

const resources = {
  zh: { translation: zh as Messages },
  en: { translation: en as Messages },
};

// expose raw for tests/tools (zh/en flat keys)
export const rawResources: Record<Locale, Messages> = {
  zh: zh as Messages,
  en: en as Messages,
};

function resolveInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem('app-locale') as Locale | null;
    if (stored && (stored === 'zh' || stored === 'en')) return stored;
    const nav = navigator.language?.toLowerCase() ?? 'zh';
    if (nav.startsWith('en')) return 'en';
    return 'zh';
  } catch {
    return 'zh';
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLocale(),
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
    prefix: '{',
    suffix: '}',
  },
});

// 持久化 + 兼容旧轻量实现的 locale-change 事件
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('app-locale', lng);
  } catch {}
  // 保持对旧订阅者的兼容
  window.dispatchEvent(new CustomEvent('locale-change', { detail: lng }));
});

export function getLocale(): Locale {
  return (i18n.language as Locale) ?? 'zh';
}

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
}

/**
 * t('search.placeholder') -> 文案；缺失则 fallback 中文，再 fallback key 本身
 * 支持简单 {current}/{total} 插值：t('pagination.page', { current: 1, total: 5 })
 * 底层走 i18next，prefix/suffix 已配为 { } 以兼容历史 {key} 写法
 */
export function t(key: string, params?: Record<string, string | number>): string {
  // i18next 的 t 已处理 fallback；为兼容旧调用，保持 string 返回
  const result = i18n.t(key, params as unknown as Record<string, unknown>);
  // i18next 在缺失时返回 key，行为与旧实现一致
  return typeof result === 'string' ? result : String(result);
}

// 兼容 i18next 风格的默认导出
export default i18n;
