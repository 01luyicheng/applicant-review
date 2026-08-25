# Applicant Review 商业化通用化总体计划（待会审稿 v0.1）

> 目标：将 `applicant-review` 打造为 **开源免费、可商用的通用活动报名审核工具**（Local-First / 配置驱动 / 零后端）  
> 作者：PM（Muse Spark）  日期：2026-08-24  状态：**DRAFT 待 5 轨会审**  
> 基线：`typecheck PASS / lint PASS / test 29+3todo coverage 47.98% / build PASS`（见审计报告）

---

## 1. 背景与问题陈述

- **现状矛盾**：`package.json:4` 宣称通用，但 `src/types.ts:29` `public/config.json:1` 的 `DEFAULT_CONFIG` 强绑定 Rebuild-Z 黑客松 S2（`你当前更偏向于参加哪个赛道` 等长问），首屏即定制。
- **商业阻塞**：无 `SECURITY.md/CODE_OF_CONDUCT/CLA-DCO/TRADEMARK/SUPPORT/PRICING/GOVERNANCE/CHANGELOG`，`xlsx@0.18.5` 已知漏洞 `package.json:43` 未闭环，`i18n 0%`，单文件 `App.tsx:17 729行` 上帝组件，测试黑洞 `ConfigBuilder 0%`。
- **机会**：已有 `config.ts` 同源+CORS+原型拦截、`storage.ts` session+掩码、`fileParser.ts` CSV注入防护、CI 三段式+Docker，底座诚实且可扩展。

## 2. 目标与非目标

| 目标 | 衡量 |
|---|---|
| **通用性**：任意 Excel/CSV 通过列映射+JSON 零代码适配 | 3 个外部表单（校招/供应商/论文）5 分钟内完成审核演示 |
| **商用就绪**：企业法务/安全/采购可零风险试用 | OSSF Scorecard ≥7、通过 `npm audit high`、有 `SECURITY.md` SLA |
| **免费可持续**：MIT 核心 + 可选 Cloud 增值 | `PRICING.md` 三档明示，`FUNDING.yml` 接入 |
| **非目标** | 不做表格竞品/不做重后端协作（Phase2 再加轻量后端）、不闭源核心 |

## 3. 商业定位（待会审）

**Open Core + 托管增值**：
- Community MIT：现仓库全部（解析/筛选/导出/Builder/Docker）
- Cloud SaaS：多租户/评论/审计/SSO/超大文件突破 5MB
- Enterprise Add-on：私有化IAM/PWA离线/`exceljs`合规分支  
*备选：纯捐赠 / 双许可，已在合规轨评估中择优*

## 4. 范围与交付物

### 4.1 代码与配置
- `DEFAULT_CONFIG` 通用化：抽 `generic.json`，原 hackathon → `config-examples/rebuildz-s2.json`
- `ViewConfig` 扩展：`FieldConfig.type`（text/number/date/email/url/select/multiselect/attachment/rating）、`options/width/sortable/searchable/required`
- 列映射向导：上传后弹窗 `Excel头 → config key (+新建字段)` 解决 `key===表头` 脆弱性
- i18n：`i18next + locales/zh.json,en.json`，首版中英
- 性能：`parseFile→Worker`、`FilterBar uniqueValuesMap` 缓存/Worker 聚合、`tanstack-virtual`、`exportToCSV` 流式

### 4.2 安全隐私
- `xlsx → exceljs` 或锁定 `0.20.3`+`npm audit` 门禁；导入侧 `^[=+\-@]` 清洗；`raw=Object.create(null)` 防原型污染 `fileParser.ts:48`
- PII：正则扩展 `phone|mail|tel|mobile|wechat` 可配 `sensitiveKeys`，移除 localStorage 静默降级，导出前掩码确认

### 4.3 开源合规（P0）
- 新增：`SECURITY.md`（security@, 90d披露, 支持版本）、`CODE_OF_CONDUCT.md`（Covenant v2.1）、`SUPPORT.md`、`TRADEMARK.md`、`GOVERNANCE.md`、`CHANGELOG.md`、`CONTRIBUTING DCO Signed-off-by`、`.github/CLA.yml` 或 `dco.yml`
- 品牌中立化：`package.json` `homepage/repository` 去 `Rebuild-Z` 占位、`README/CONTRIBUTING` TODO 收敛、`scripts/rebrand.sh`

### 4.4 工程质量
- 拆 `App.tsx` → `hooks/useConfig/useApplicants/useFilters/useHistory + ErrorBoundary`，`zod` 替代手写校验 `config.ts:221`
- 测试：补 `parseFile`、`ConfigBuilder` 交互、键盘快捷键 `shortcuts.ts`，`App.smoke` 去 todo，`coverage threshold 50%→70%`
- CI：`ci.yml` 加 `coverage/concurrency/permissions/read/audit`，pin `netlify/actions@sha`，`softprops@ v2`，`docker/.dockerignore`，真推 `ghcr.io`，补 `.nvmrc` `engines` `commitlint+husky` `dependabot.yml`

### 4.5 文档
- `README_EN.md`、`docs/DEPLOY.md`（4路部署）、`docs/FAQ.md`、`ROADMAP.md`、`PRICING.md`

## 5. 分阶段里程碑

| 阶段 | 周期 | 准出标准 | 关键里程碑 |
|---|---|---|---|
| **Phase 0 合规冲刺** | 1-2 周 | OSSF ≥7, 法务可签 | `SECURITY+CLA+TRADEMARK` 合并，品牌中立脚本合入，`npm audit high=0` |
| **Phase 1 商业MVP** | 1-2 月 | 外部用户 5 分钟演示成功率 ≥80% | 通用化+i18n+映射向导上线，`demo.*` 部署，`PRICING/FUNDING` 上线，`xlsx` 替换分支合入 |
| **Phase 2 规模化** | 3-6 月 | 付费转化路径跑通 | PWA `vite-plugin-pwa` 落地，轻量协作后端，配置市场独立仓 |

## 6. 组织：PM led 5 轨 Subagent

| Subagent | 职责 | 首要交付 | 审查本计划时关注点 |
|---|---|---|---|
| **A 架构** | 拆上帝组件、性能、类型安全 | `hooks/* + zod + Worker` | 计划是否低估耦合/是否缺虚拟化/Worker 成本 |
| **B 安全隐私** | 供应链/PII/注入 | `exceljs + 脱敏策略` | 计划法务口径是否自洽、掩码后4位是否仍算 PII、日志是否仍 POST /log |
| **C 通用化UX** | 配置体系/i18n/向导 | `FieldConfig 扩展 + i18n` | 是否真零代码、非技术 HR 能否不用看 JSON |
| **D 开源合规** | LICENSE/社区/商业模式 | `6份MD + DCO` | Open Core 是否与 MIT 冲突、商标/定价是否让法务说 Yes |
| **E DevOps** | CI/测试/发布 | `coverage门禁+ghcr` | 计划测试目标是否可达、CI 成本/并发是否合理 |

并行机制：各轨在 **24h 内** 对本稿提交 `问题/风险/建议`（模板见 §8），PM 日更 `ISSUES_LOG` 并裁决。

## 7. 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| 通用化过度设计导致 Phase1 延期 | 中 | 先做列映射向导+i18n，`FieldConfig.type` 分批 |
| `exceljs` 替换引入回归 | 中 | 保留 `xlsx` 分支 Feature Flag，灰度 |
| i18n 字符串遗漏 | 高 | `eslint i18n` 规则 + 脚本扫描中文硬编码 |
| 社区冷启动 | 中 | `demo` + `config-examples` 画廊 + ProductHunt/awesome-list |

## 8. 本计划的会审机制（本次任务）

**会审目标**：不是审代码，是审**本计划本身是否可执行、可商用、完整**。

**会审维度**（每轨必填）：
- 完整性：是否漏 P0 阻塞（法务/安全/通用）？
- 可行性：工期/依赖是否乐观？有无隐藏成本？
- 一致性：各章节是否自洽（如隐私“不上传” vs `logger POST /log`）？
- 可验证性：准出标准是否可度量？
- 优先级：是否有更该提前/延后的事项？

**输出格式**（每轨一份，≤300字 + 表格）：
```
结论：通过/有条件通过/不通过
阻塞问题：...
建议：...
风险上调/下调：...
```

会审后 PM 动作：汇总 `REVIEW_LOG`，定版 `v1.0` 并建 `GitHub Milestone: Phase0/1/2 + Issue`。

## 9. 待裁决开放问题（会审重点）

1. `DEFAULT_CONFIG` 通用化：最小 generic vs 保留 hackathon 默认+启动预设选择器，哪个转化更好？
2. `ALLOWED_ORIGINS` 放宽到可配白名单是否引入新攻击面？
3. Open Core 定价：Cloud 是否该在 Phase1 即收费，还是先免费获量？
4. `coverage 70%` 是否应阻塞合并，还是先 50% 渐进？
5. PWA 放在 Community 还是 Enterprise 付费？

---

## 附：基线证据索引

- 通用性缺口：`src/types.ts:29` `public/config.json:1` `ConfigBuilder.tsx:39` `FilterBar.tsx:48`
- 安全缺口：`fileParser.ts:48` `storage.ts:18` `config.ts:17` `logger.ts:34`
- 合规缺口：`release.yml:28` 无 CHANGELOG、`package.json:29` Rebuild-Z 硬编码
- 工程缺口：`App.tsx:17` `coverage 47.98%` `ConfigBuilder 0%` `ci.yml:9`

> 会审入口：各 subagent 请基于本稿 + 仓库实地 `read` 校验后输出审查意见，PM 统一收敛。
