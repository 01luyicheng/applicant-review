# Applicant Review 商业化通用化总体计划 v1.0（已会审定版）

> 目标：打造 **开源免费、可商用** 的通用活动报名审核工具（Local-First / 配置驱动 / 零后端）  
> 状态：**已通过 5 轨会审**（见 `PLAN_REVIEW_LOG.md`）  基线：`typecheck PASS / lint PASS / test 29+3todo 47.98% / build PASS`

## 1. 背景与裁决

- **矛盾**：`package.json:4` 称通用，`src/types.ts:29` `public/config.json:1` 默认却是 YOUR_ORG 黑客松定制。
- **会审裁决**：5 轨一致「有条件通过」——方向正确但工期乐观、口径不自洽、清单不全。v1.0 已吸收全部阻塞项。
- **P0 定义**：不做即**不可宣称“免费商用”**（法务/安全拦截）。

## 2. 商业定位（定版）

**Open Core + 托管增值**（合规轨确认与 MIT 自洽，已补 `TRADEMARK.md+NOTICE` 划清）

| 层 | 许可 | 功能 | 收费 |
|---|---|---|---|
| Community | MIT | 现仓库全部 | 免费 |
| Cloud | 闭源 SaaS | 多租户/评论/审计/SSO/超大文件 | 按席/按场 |
| Enterprise | 商业许可 | 私有化IAM/PWA离线/`exceljs`合规 | 年费支持 |

*定价策略 v1.0：Phase1 先免费获量，Phase1.5 再开 Cloud 收费，PWA 归属待定保持诚实文案。*

## 3. 范围（v1.0 修订版）

### 3.1 通用化 UX（C 轨吸收）
- **默认去品牌**：新增 `public/config-examples/generic.json`（`id/姓名/邮箱/状态 4列` 最小模板）为 `DEFAULT_CONFIG`，原 hackathon 下沉至 `rebuildz-s2.json`；启动提供 **配置画廊** 一键切换（hackathon/campus/scholarship/vendor/generic）。
- **列映射向导（3步）**：`上传 → 映射表（自动匹配 + 未匹配建新字段 + 重命名/去重冲突预览）→ Diff/撤销预览`，强制首次上传触发，解决 `key===表头` 脆弱性。
- **`ViewConfig` 扩展**：`FieldConfig { key,label, type: text|textarea|number|date|email|url|select|multiselect|attachment|rating|boolean|currency|phone, options?, width?, sortable?, searchable?, required?, filter: exact|range|search }`；`multiline → type=textarea` 收敛；`sensitiveKeys?: string[]` 可配。
- **i18n**：`i18next + locales/zh.json,en.json`，`eslint i18n` + 中文扫描脚本，错误码走 `t()`。
- **空状态**：首屏 `加载示例数据` + 插画 + `无匹配→清除筛选 CTA`，破坏性操作二次确认。

### 3.2 安全隐私（B 轨吸收）
- **供应链**：`npm audit --audit-level=high` CI 门禁 `high=0`；`xlsx@0.18.5` 先 `sanitize` 缓解，`exceljs` 为 **Feature Flag 灰度分支**（非阻塞）。
- **注入**：`fileParser.ts:48` 统一 `raw = Object.create(null)` + 递归 `sanitizeConfigData`；导入侧清洗 `^[=+\-@|%]` 公式；`zod.superRefine` 防 `__proto__`。
- **PII**：策略三档 `mask/strip/none`（默认 `strip` 导出前二次确认）；移除 `storage.ts:59,116` 静默降级/迁移 `localStorage`；敏感键默认 `手机|邮箱|微信|phone|mail|tel|mobile|wechat` 且可配；`logger.ts:34 POST /log` **默认禁用**，需 `VITE_ENABLE_LOG=1` 显式开启，`SENTRY` 采样。

### 3.3 架构（A 轨吸收）
- **拆分策略**：小步走——Phase0 先 `useConfig/useFilters + ErrorBoundary`，Phase1 再 `useApplicants/useHistory`；先定状态机与单测再拆，工期 ×1.5 预算。
- **性能**：Phase1 仅 `FilterBar uniqueValuesMap memo` + `exportIdle` 保留；**Worker/虚拟化降为 Phase1.5**（与分页二选一待数据裁决）。新增 SLA：`10k行解析 P95<2s / INP<200ms / 导出10k<1s` + Lighthouse CI。
- **校验**：`config.ts:221` 手写 → `zod` + 快照，`ReviewStatus` 联合类型收敛。

### 3.4 合规（D 轨吸收）
- 新增 8 份：`SECURITY.md`（security@, 90d, 支持版本）、`CODE_OF_CONDUCT.md`、`SUPPORT.md`、`TRADEMARK.md`、`GOVERNANCE.md`、`CHANGELOG.md`、`PRICING.md`、`NOTICE` + `DCO`（`dco.yml + Signed-off-by` 替代 CLA）。
- 品牌：`scripts/rebrand.sh` 一键替换 `YOUR_ORG→<<ORG>>`，`package.json:29` 等去硬编码。
- 供应链加固：`dependabot.yml` + `codeql.yml` + `scorecard.yml` + SBOM/provenance。

### 3.5 工程（E 轨吸收）
- **覆盖率阶梯**：Phase0 `50% 阻塞 + 70% 告警`，Phase1 再 `70% 阻塞`（基线 47.98%，`ConfigBuilder 0%` 322行需补）。
- **CI**：`ci.yml` 加 `concurrency: ci-${{github.ref}} / permissions: contents:read / npm audit`，pin `checkout/setup-node/netlify/softprops/docker` 至 SHA，`softprops@v1→v2`，`vite.config.ts:21` 加 `coverage.thresholds`。
- **发布**：`docker/.dockerignore`，真推 `ghcr.io`（`login+metadata+push:true+provenance`），修 `release.yml:28` CHANGELOG 断链。
- **环境**：`.nvmrc` + `package.json engines` + `husky+commitlint`。

## 4. 里程碑（修订后）

| 阶段 | 周期 | 准出（可度量） | 关键交付 |
|---|---|---|---|
| **Phase 0 合规冲刺** | 2-3 周（上调） | OSSF ≥7, `audit high=0`, 覆盖率 50% 阻塞, `generic` 画廊可演示 | 8份MD + rebrand.sh + `logger` 默认禁用 + `audit` 门禁 + `useConfig` 拆分 |
| **Phase 1 商业MVP** | 6-8 周（上调） | n≥15 HR 录屏独立完成导入-映射-筛选-导出成功率≥80% SUS≥70 | 向导+ i18n + `FieldConfig` 扩展 + `demo.*` + `PRICING/FUNDING` |
| **Phase 1.5 性能** | 2-3 周 | SLA 达标（P95<2s/INP<200ms） | Worker/虚拟化二选一 |
| **Phase 2 规模化** | 3-6 月 | 付费链路跑通 | 轻量协作后端 + 配置市场独立仓 |

## 5. 组织：PM led 5 轨（执行分工）

| Subagent | 领Phase0 | 领Phase1 | 验收标准 |
|---|---|---|---|
| **A 架构** | `useConfig/useFilters+zod+ErrorBoundary` | `useApplicants/useHistory + 性能SLA` | `App.tsx` 行数<300, 单测≥60% |
| **B 安全** | `audit门禁+导入清洗+存储三档` | `exceljs Flag + logger开关` | `npm audit 0`, `gitleaks 0`, 隐私章与代码一致 |
| **C 通用UX** | `generic+画廊+中文扫描` | `向导3步+ i18n全量 + FieldConfig` | HR 5分钟录屏通过率 |
| **D 合规** | `8份MD+DCO+rebrand` | `PRICING/SUPPORT 定价落地` | OSSF 7+, 法务 checklist 全勾 |
| **E DevOps** | `CI 4件套+阈值50%+ghcr真推` | `阈值70%+Lighthouse` | CI 全绿, 镜像可拉 |

**协同**：PM 日更 `PLAN_REVIEW_LOG.md`，每轨 24h 内提交阻塞，`GitHub Milestone` 驱动。

## 6. 风险（会审后重估）

| 风险 | 调整 | 缓解 |
|---|---|---|
| 拆分回归 | 上调 | 小步+单测先行 |
| i18n 遗漏 | 上调→极高 | 扫描脚本 +  pre-commit |
| 覆盖率 70% 跳变 | 上调 | 阶梯 50→70 |
| 供应链虚假安全感 | 下调 | Flag 灰度非阻塞 |

## 7. Issue 拆解（创建顺序）

- `#1-#8` 合规 8份MD  `#9 rebrand.sh`  `#10 audit门禁`  `#11 logger开关`  `#12 存储三档`
- `#13 generic+画廊`  `#14 向导3步`  `#15 FieldConfig扩展`  `#16 i18n`
- `#17 useConfig/useFilters`  `#18 zod`  `#19 测试50%`  `#20 CI四件套+ghcr`  `#21 SLA基线`

## 8. 开放裁决（已定）

1. 默认通用化→ `generic` 最小模板 + 画廊（优于静态替换） 2. 白名单→可配但默认同源 3. 定价→先免费 4. 覆盖率→阶梯 5. PWA→延后诚实

---

*定版签名：PM + A/B/C/D/E 2026-08-24*  
*下一步：建 Milestone 并分派 Issue，Phase0 启动*
