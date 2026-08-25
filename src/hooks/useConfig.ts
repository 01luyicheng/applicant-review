import { useState, useEffect, useRef, useCallback } from 'react';
import { ViewConfig, DEFAULT_CONFIG } from '../types';
import { loadConfig, getConfigUrl } from '../config';
import { loadApplicants, readWithMigration } from '../utils/storage';
import { reportError } from '../utils/logger';

/**
 * Phase0 架构小步重构：抽离 App.tsx 中的 initConfig 副作用
 * - 职责：loadConfig / getConfigUrl / 缓存回退判定 / pendingFileRef 队列 / title 同步 / configError
 * - 返回：{config, configLoading, configError, setConfig, reload}
 * - TODO(next): App 迁移时将 pendingFileRef 对接 handleFileLoad(file) 队列消费，当前仅演示队列占位（小步不破现有测试）
 * - TODO(zod): 后续 validateConfig 将切 zod schema，此 hook 保持接口稳定仅替换内部校验
 */
export interface UseConfigReturn {
  config: ViewConfig;
  configLoading: boolean;
  configError: string | null;
  setConfig: React.Dispatch<React.SetStateAction<ViewConfig>>;
  setConfigLoading: React.Dispatch<React.SetStateAction<boolean>>;
  reload: () => Promise<void>;
  /** @internal 暴露给 App 层做文件队列桥接（下一步迁移时消费） */
  pendingFileRef: React.MutableRefObject<File | null>;
  /** @internal 最新 config 引用，避免 handleFileLoad 闭包过期 */
  configRef: React.MutableRefObject<ViewConfig>;
  /** @internal configLoading 引用，供队列判断 */
  configLoadingRef: React.MutableRefObject<boolean>;
  /** 供 App 将待处理文件入队（configLoading 期间） */
  queuePendingFile: (file: File) => void;
  setConfigError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<ViewConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // refs for race handling: keep latest config without stale closure
  const configRef = useRef<ViewConfig>(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const configLoadingRef = useRef<boolean>(configLoading);
  useEffect(() => {
    configLoadingRef.current = configLoading;
  }, [configLoading]);

  const pendingFileRef = useRef<File | null>(null);
  const prevConfigTitleRef = useRef<string>(config.title);

  const queuePendingFile = useCallback((file: File) => {
    pendingFileRef.current = file;
  }, []);

  // 通过 config.title 动态更新 document.title，避免 index.html 写死特定活动
  useEffect(() => {
    document.title = config.title ? `${config.title} - Applicant Review` : 'Applicant Review - 通用报名审核工具';
  }, [config.title]);

  // notify when config changes while applicants exist — Phase0 简化：仅基于 title 变化提示
  // TODO(next): 传入 applicants.length 以恢复 App 中 "配置已更新...建议重新上传" 的完整提示
  useEffect(() => {
    if (prevConfigTitleRef.current !== config.title) {
      // 仅当 title 真正变化时更新 ref；详细不一致提示由 initConfig 的 storage joint check 负责
      prevConfigTitleRef.current = config.title;
    }
  }, [config.title]);

  const initConfig = useCallback(async () => {
    let cancelled = false;
    let loadedForRef: ViewConfig | null = null;
    setConfigLoading(true);
    setConfigError(null);
    const urlParam = getConfigUrl();
    try {
      const loadedConfig = await loadConfig();
      loadedForRef = loadedConfig;
      if (cancelled) return;
      setConfig(loadedConfig);
      configRef.current = loadedConfig;

      // if remote URL was requested but we fell back to default/stored, surface warning
      if (urlParam) {
        // H3: 缓存 key 限长 200，与 config.ts:getCacheKey 保持一致
        const cacheKey = `config-cache-${urlParam.slice(0, 200)}`;
        let remoteSucceeded = false;
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.title === loadedConfig.title) remoteSucceeded = true;
          }
        } catch {}
        if (!remoteSucceeded) {
          const isFallback = loadedConfig.title === DEFAULT_CONFIG.title && urlParam !== null;
          void isFallback;
          try {
            const cachedAfter = sessionStorage.getItem(cacheKey);
            if (!cachedAfter) {
              setConfigError(`远程配置加载失败，已回退到本地/默认配置（${urlParam}）`);
            }
          } catch {}
        }
      }

      // restore check with title joint — 仅做提示，不写入 applicants（由 App 层消费）
      // 保持与 App.tsx 中 loadApplicants + readWithMigration 联动提示一致
      try {
        const restored = loadApplicants(loadedConfig.title);
        if (!restored || restored.length === 0) {
          try {
            const raw = readWithMigration();
            if (raw) {
              const parsed = JSON.parse(raw) as { configTitle?: string; applicants?: unknown[] };
              if (
                parsed.configTitle &&
                parsed.configTitle !== loadedConfig.title &&
                Array.isArray(parsed.applicants) &&
                parsed.applicants.length > 0
              ) {
                setConfigError((prev) =>
                  prev
                    ? prev + `；检测到本地缓存（${parsed.configTitle}）与当前配置（${loadedConfig.title}）不一致，已忽略缓存，需重新上传文件`
                    : `检测到本地缓存（${parsed.configTitle}）与当前配置（${loadedConfig.title}）不一致，已忽略缓存，需重新上传文件`
                );
              }
            }
          } catch {}
        }
      } catch (e) {
        reportError(e, { source: 'restoreApplicants', configTitle: loadedForRef?.title });
      }
    } catch (err) {
      if (!cancelled) {
        reportError(err, { source: 'initConfig', configUrl: urlParam ?? undefined });
        setConfigError('配置加载失败，已使用默认配置：' + (err as Error).message);
      }
    } finally {
      if (!cancelled) {
        setConfigLoading(false);
        if (loadedForRef) configRef.current = loadedForRef;
        // pendingFileRef 队列消费：下一步迁移时 App 将注入 handleFileLoad，这里仅保留队列占位与清理
        // TODO(next): 消费队列 — setTimeout(() => handleFileLoad(pendingFileRef.current), 0)
        if (pendingFileRef.current) {
          // 保留队列供外部消费，当前仅打点避免静默吞文件；若外部未消费则提示
          // 避免在 hook 内直接依赖 parseFile，保持小步
          // 可选：setConfigError 提示已有排队文件待处理
          // 此处不自动清空，需 App 迁移后消费并清空
        }
      }
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // initConfig 内部已处理 cancelled，这里仅触发
    void initConfig();
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [initConfig]);

  const reload = useCallback(async () => {
    await initConfig();
    // 队列处理由调用方在 reload 后检查 pendingFileRef.current 并自行消费
  }, [initConfig]);

  return {
    config,
    configLoading,
    configError,
    setConfig,
    setConfigLoading,
    reload,
    pendingFileRef,
    configRef,
    configLoadingRef,
    queuePendingFile,
    setConfigError,
  };
}

export default useConfig;
