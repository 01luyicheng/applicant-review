# ROADMAP — Applicant Review 版本路线图

> 关联：`docs/PLAN_COMMERCIALIZATION.md v1.0` 已会审定版 · 基线 `2026-08-24` · `typecheck PASS / test 14 files 128 passed + 3 todo / coverage lines 76.85% statements 72.73% branches 63.19% functions 70.71% thresholds 70/70/60/70 阻塞已达成 · PWA 已落地（sw.js/manifest.webmanifest，VitePWA autoUpdate）`
> 维护：PM 驱动 `docs/internal/PLAN_REVIEW_LOG.md` 日更（已归档至 `docs/internal/`），`GitHub Milestone` 驱动 Issue。

## 0. 版本总览

| 阶段 | 周期（相对 2026-08-24） | 主题 | 准出 SLA（阻塞） | 目标人群 |
|------|------------------------|------|----------------|----------|
| **Phase 0 合规冲刺** | W1-W3 · 2-3 周 | 去品牌、法务/安全合规、CI 骨架 | 见 §1 | 开源贡献者、首批试用 HR |
| **Phase 1 商业 MVP** | W4-W11 · 6-8 周 | 向导 + i18n + FieldConfig 全量 | 见 §2 | HR / 活动运营 n≥15 独立可用 |
| **Phase 1.5 性能** | W12-W14 · 2-3 周 | 大表性能、SLA 达标 | 见 §3 | 1k~10k 行重度用户 |
| **Phase 2 规模化** | W15-W38 · 3-6 月 | 协作后端、配置市场、付费链路 | 见 §4 | 团队/企业客户 |
| **Enterprise / Cloud** | 2027 H1 规划 | 私有化、IAM/SSO、审计、合规加固 | 见 §5 | 企业版 / Cloud SaaS |

> 工期口径已按 v1.0 会审 ×1.5 缓冲上调；每阶段先“告警阈值 → 测试补齐 → 转阻塞阈值”阶梯演进。

---

## 1. Phase 0 — 合规冲刺（2-3 周）

**目标**：可公开发布的 **MIT 免费商用** 基线，宣称与代码一致。

### 1.1 关键交付

- 8 份合规文档：`SECURITY.md / CODE_OF_CONDUCT.md / SUPPORT.md / TRADEMARK.md / GOVERNANCE.md / CHANGELOG.md / PRICING.md / NOTICE` + `DCO（dco.yml + Signed-off-by）`
- 品牌去硬编码：`scripts/rebrand.sh YOUR_ORG`，`package.json:homepage/repository/bugs` 占位 `YOUR_ORG` 可一键替换
- `public/config.json` → `generic` 最小模板（`姓名/邮箱/状态/备注 4列`，`detailGroups: 基本信息/审核状态`），原 hackathon 下沉 `public/config-examples/hackathon.json` + 画廊（`generic/hackathon/campus-recruit/scholarship/vendor` 5 套，`App.tsx` header 下拉 + 中/EN 按钮）
- 安全：`logger.ts: VITE_ENABLE_LOG=1` 默认禁用才能 `POST /log`；`fileParser.ts / config.ts` 递归 `sanitizeConfigData` 防 `__proto__`；`npm audit --audit-level=high` CI 门禁 `high=0`；`xlsx@0.18.5` 保留 fallback，主路径 `exceljs@^4.4.0`（`fileParser.ts:tryParseWithExcelJS` 动态 import）
- 架构小步拆分：`App.tsx 208 行` hooks 拆分 `useConfig/useFilters/useApplicants/useHistory/useExport/useGallery/usePersistence/useKeyboardShortcuts + ErrorBoundary`，`zod 单源`校验（`config.ts:configSchema`），`VitePWA autoUpdate` 已启用
- DevOps：`ci.yml: concurrency / permissions: contents:read / checkout/setup-node/netlify/softprops/docker pin SHA / softprops v1→v2 / coverage 70/70/60/70 阻塞已达成（PWA 已落地 sw.js/manifest.webmanifest） / ghcr.io 假推验证`

### 1.2 准出 SLA（阻塞）

| 指标 | 阈值 | 验证 |
|------|------|------|
| OSSF Scorecard | ≥7 | `scorecard.yml` |
| `npm audit --audit-level=high` | `high=0` | `ci.yml: audit`（`xlsx@0.18.5` 已 sanitization 缓解，审计失败告警不阻塞待 Phase1 `exceljs` Flag） |
| 覆盖率 | `lines 70 / statements 70 / branches 60 / functions 70` 阻塞 **已达成**（实测 `76.85%/72.73%/63.19%/70.71%`，`vite.config.ts:test.coverage.thresholds: lines 70 / branches 60 / functions 70 / statements 70` 已转阻塞，PWA 已落地） | `vite.config.ts:test.coverage.thresholds` + `npm run coverage` |
| 可演示 | `generic` 画廊一键切换、本地 `npm run dev` 拖拽 `example.csv` 10 行成功 | `docs/MANUAL_WALKTHROUGH.md` |
| 法务 checklist | 8 份 MD + `LICENSE MIT` + `TRADEMARK/NOTICE` 划清商标 | D 轨验收 |

### 1.3 Issue 拆解（创建顺序 `#1-#12, #17-#21`）

`#1-#8` 合规 8 份 · `#9 rebrand.sh` · `#10 audit门禁` · `#11 logger开关` · `#12 存储三档` · `#17 useConfig/useFilters` · `#18 zod` · `#19 测试 50%` · `#20 CI四件套+ghcr` · `#21 SLA基线`

---

## 2. Phase 1 — 商业 MVP（6-8 周）当前阶段

**目标**：HR 5 分钟独立完成 `导入 → 映射 → 筛选 → 导出`，可收费前获量。

### 2.1 关键交付（已部分落地）

| 模块 | 状态 | 说明 |
|------|------|------|
| 列映射向导 3 步 | ✅ 已交付 | `ColumnMappingModal.tsx 305 行` · `上传→映射表（autoMatchHeader 完全相等/包含匹配）→未匹配建新字段+重命名/去重→Diff/撤销预览` · `mappingThreshold` 可配（默认 0.3 即 30% 缺失弹向导，`ViewConfig.mappingThreshold`） |
| `ViewConfig` 扩展 | ✅ 已交付 | `FieldConfig { type: text/textarea/number/date/email/url/select/multiselect/attachment/rating/boolean/currency/phone, options?, width?, sortable?, searchable?, required?, filter: exact/range/search, visibleInList?, multiline? }` · `sensitiveKeys?` + `mappingThreshold?`；`multiline→type=textarea` 收敛 |
| i18n | ✅ 已交付 | `i18next@^23.15.1 + react-i18next@^13.5.0` · `src/i18n.ts: fallbackLng:'zh', localStorage:app-locale, prefix/suffix:{ }` · `locales/zh.json / en.json 70+ 词条全量对照` · `FilterBar/FileUploader/App header 中/EN` 已全量 `t()` 化，Header 有 `gallery` + `中/EN` 按钮 |
| 空状态/撤销 | ✅ 已交付 | 首屏 `加载示例数据` + 插画 + `无匹配→清除筛选 CTA` + 破坏性操作二次确认 + `Ctrl+Z` 撤销（`useHistory`） |
| 配置画廊 | ✅ 已交付 | `public/config-examples/* (generic/hackathon/campus-recruit/scholarship/vendor 5 套) + README 画廊` · `App.tsx header` 下拉一键加载（`useGallery`） |
| Worker 解析 | ✅ 已交付 | `src/workers/parseWorker.ts 243 行` + `fileParser.ts:parseFile` 优先 `Worker` + `exceljs` 主路径、`xlsx` 回退，10s 超时回退主线程；`vite.config.ts:worker.format='es'` |
| PWA 离线 | ✅ 已交付 | `vite-plugin-pwa@^1.3.0` · `VitePWA({ registerType:'autoUpdate', includeAssets:['config.json'] })`，离线可审核 |
| zod 单源 | ✅ 已交付 | `src/config.ts:configSchema` zod 单轨（已删 150 行手写 legacy），`getConfigValidationErrors/validateConfig` 单源真理，H3 原型污染与 `statusValues.value` 去重保留 |
| 覆盖率补齐 | ✅ 已达成 | `14 files / 128 passed + 3 todo` · `lines 76.85% / statements 72.73% / branches 63.19% / functions 70.71%` · 阈值 `70/70/60/70 阻塞已达成`（已转阻塞），PWA 已落地（`sw.js`/`manifest.webmanifest`）；`fileParser 真文件 + mapping E2E` 已补齐 |

### 2.2 准出 SLA（阻塞）

| 指标 | 阈值 | 验证方式 |
|------|------|----------|
| 可用性 | n≥15 HR 录屏 **独立**完成导入-映射-筛选-导出 **成功率 ≥80%** | 可用性测试（非 jsdom，需真机录屏） |
| 满意度 | **SUS ≥70** | 标准化问卷 |
| 覆盖率 | `lines 70 / statements 70 / branches 60 / functions 70` 阻塞 **已达成**（实测 `76.85%/72.73%/63.19%/70.71%`，PWA 已落地） | `npm run coverage` |
| 文档 | `docs/DEPLOY.md / FAQ.md / ROADMAP.md` 齐全，`README 诚实文案` | 本 Phase2 交付 |

### 2.3 剩余收口（Phase2 本批次）

- `docs/ROADMAP.md`（本文件）· `docs/DEPLOY.md` · `docs/FAQ.md` · `README 诚实化` · `FUNDING.yml` · `release.yml / ci.yml ghcr 真推示例注释`

---

## 3. Phase 1.5 — 性能（2-3 周）

**目标**：大表可用性达到发布 SLA。

### 3.1 SLA

| 指标 | 阈值 | 备注 |
|------|------|------|
| 解析 | **10k 行 P95 <2s** | `xlsx + fileParser`，含 `sanitize`；超 10k 建议分页/后端 |
| 交互 | **INP <200ms** | `FilterBar uniqueValuesMap memo` + `exportIdle` 已保留；Worker/虚拟化二选一待数据裁决 |
| 导出 | **10k 行 <1s** | 含 BOM，`Blob` 流式 |
| Lighthouse CI | Performance ≥90 / Accessibility ≥90 | `lighthouserc`（Phase2 加门禁） |

### 3.2 技术选型（与分页二选一，数据裁决）

- **Worker**：✅ 已交付 — `src/workers/parseWorker.ts 243 行` + `fileParser.ts:parseFile` Worker 优先（`new Worker(new URL(...), {type:'module'})`，10s 超时回退主线程，`ArrayBuffer` transfer），`exceljs` 主路径 `xlsx` 回退；`vite.config.ts:worker.format='es'` 已配。
- **虚拟化**：`react-window / tanstack-virtual` 渲染 10k 行视口；代价：键盘 `↑↓` 与 `tabIndex` 需适配 — 按真实 10k 压测后与分页二选一，当前未启用。
- 当前 Phase1 已保留 **`FilterBar uniqueValuesMap memo + exportIdle` + Worker**，虚拟化/分页降为 Phase1.5 按需启用。

### 3.3 Issue 拆解

`#SLA 基线 #Worker/虚拟化二选一 #分页策略 #Lighthouse CI`

---

## 4. Phase 2 — 规模化（3-6 月）

**目标**：付费链路跑通，支撑团队协作与规模化分发。

### 4.1 关键交付

| 方向 | 内容 |
|------|------|
| 轻量协作后端 | 多租户、评论/备注、审计日志、SSO（OIDC）、超大文件分片上传；**仍保持 Local-First**，后端仅协作与审计 |
| 配置市场 | `config-examples` 独立仓 + 版本化 + 一键拉取（`?config=` 同源白名单可配） |
| 发布加固 | `ghcr.io` 真推（`push:true + provenance + sbom`）、SBOM/provenance、`CHANGELOG` 断链修复、`.dockerignore` |
| 测试 | 覆盖率 **70% 阻塞**（`lines/statements 70 / branches 60 / functions 60-70`），重点 `ColumnMappingModal / DetailModal / FileUploader / shortcuts / ErrorBoundary` |

### 4.2 准出 SLA

- 付费链路（Cloud 按席/按场）可下单、可开票、可审计
- `npm run typecheck / build / coverage` 全绿，`docker pull ghcr.io/<org>/applicant-review:<tag>` 可拉取

---

## 5. 后续企业版规划（Enterprise / Cloud）

> 按 `PLAN_COMMERCIALIZATION.md §2` Open Core 模型，Community 保持 MIT 免费。

| 层 | 许可 | 功能边界 | 收费 |
|----|------|----------|------|
| **Community** | MIT | 现仓库全部（Local-First / 配置驱动 / 零后端） | 免费 |
| **Cloud** | 闭源 SaaS | 多租户、评论/审计、SSO、超大文件、托管域名 | 按席/按场 |
| **Enterprise** | 商业许可 | 私有化部署、IAM 集成、PWA 离线（`vite-plugin-pwa`）、`exceljs` 合规替换、`SENTRY` 私有化 | 年费支持 |

### 5.1 企业版路线（2027 H1 候选）

- **合规加固**：`xlsx@0.18.5 → exceljs` Feature Flag 已转正（当前 `exceljs@^4.4.0` 主路径、`xlsx` 保留 fallback，动态 import 已拆 `manualChunks: xlsx/exceljs/react`），`npm audit high=0` 零告警；`gitleaks` 提交前扫描；`SENTRY` 采样与 `VITE_ENABLE_LOG` 企业级开关
- **离线可用**：✅ 已交付 — `vite-plugin-pwa@^1.3.0` `VitePWA({ registerType:'autoUpdate', includeAssets:['config.json'] })` 已在 `vite.config.ts` 启用，Service Worker 缓存 `dist + config.json`，离线仍可审核（`docs/MANUAL_WALKTHROUGH.md` §7 已纳入离线验证）
- **私有化部署**：`docker-compose` + `Helm` 一键私有化；`ALLOWED_ORIGINS` 白名单可配（当前默认同源，见 `src/config.ts:14`）
- **定价策略**：Phase1 免费获量 → Phase1.5 性能达标（Worker 已交付）→ Phase2 再开 Cloud 收费；PWA/Worker 已在 Community 交付，文案已诚实更新

### 5.2 不做清单（Non-Goals）

- 不做重后端表格存储（保持 Local-First，协作仅补审计/评论）
- 不做 `xlsx` 深度定制（`exceljs` 主路径已转正，`xlsx` 仅 fallback）
- PWA 离线已交付（`vite-plugin-pwa@^1.3.0` 已启用），时效以 Service Worker `autoUpdate` 为准

---

## 6. 依赖与诚实性

- `xlsx@^0.18.5` 已知 Prototype Pollution / ReDoS，`sanitizeConfigData + sanitizeFileData` 缓解，`package.json:_comment_xlsx` 已说明；`exceljs@^4.4.0` 已为主路径（`fileParser.ts:tryParseWithExcelJS` 动态 import），`xlsx` 保留回退，`manualChunks: xlsx/exceljs/react` 已拆包
- `vite-plugin-pwa@^1.3.0` 已安装并启用，`vite.config.ts:VitePWA({ registerType:'autoUpdate', includeAssets:['config.json'] })` 与 `docs/MANUAL_WALKTHROUGH.md` 离线验证一致
- 包管理器 `npm + package-lock.json`（`CONTRIBUTING.md` 已统一）

---

## 7. 里程碑看板（GitHub Milestone 建议）

```
Milestone: Phase0-合规冲刺  Due: 2026-09-14  Issues: #1-#12 #17-#21
Milestone: Phase1-商业MVP   Due: 2026-11-09  Issues: #13-#16 + 本批次 docs
Milestone: Phase1.5-性能    Due: 2026-11-30  Issues: Worker/虚拟化/Lighthouse
Milestone: Phase2-规模化   Due: 2027-02-28  Issues: 协作后端/配置市场/ghcr真推/覆盖率70
```

> 更新方式：PM 周更 `docs/internal/PLAN_REVIEW_LOG.md`（归档于 `docs/internal/`，含 `PLAN_COMMERCIALIZATION_DRAFT.md` / `PERF_DECISION.md` 内部稿），每轨 24h 内提交阻塞。

---

*定版：`PLAN_COMMERCIALIZATION v1.0` 2026-08-24 · 本 ROADMAP 由 Phase2 文档与发布 subagent 生成，`npm run typecheck / build` 已验证。*
