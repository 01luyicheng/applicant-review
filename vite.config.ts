/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['config.json'],
      manifest: {
        name: 'Applicant Review',
        short_name: 'Review',
        theme_color: '#111827',
      },
    }),
  ],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // 覆盖率阶梯说明（Coverage Staircase）：
      // - 基线 47.98%（Phase -1, 审计前）→ Phase0 目标 50% 阻塞（lines/statements 50, branches/functions 40）已达成 51.49%
      // - Phase1：维持 50/40 阻塞，70/60 告警（lines/statements 70 告警, branches/functions 60 告警），重点已补 parseFile 真文件 + 列映射 E2E，达成 62.25%/64.28%
      // - Phase2（前值）：lines/statements 65 阻塞, branches 55 阻塞, functions 60 阻塞（先告警后阻塞）
      // - E4 P0 阶梯收敛（已收口）：70/70/60/70 阻塞，达成 70% 承诺（lines/statements 70, branches 60, functions 70）
      // - 收口：70%阻塞（lines/statements 70, branches 60, functions 70）—— 2026-08-25 将阈值由 68/68/58/62 提升至 70/70/60/70 阻塞，CI 以此为失败门槛
      // - 演进策略：每阶段先加“告警阈值”→ 测试补齐 → 转“阻塞阈值”；CI 中 `npm run coverage` 以 thresholds 作为失败门槛
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.config.*',
        '**/*.d.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
  // Phase1.5 Worker 配置：Vite 原生支持 `new Worker(new URL(...), {type:'module'})`
  // worker.format='es' 保证与主包同为 ESM，避免 CJS 互操作；xlsx chunk 仍由主包 manualChunks 管理，Worker 内 dynamic import('xlsx') 会复用浏览器缓存
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})