# 计划会审纪要 v0.1 → v1.0

> 审查对象：`docs/PLAN_COMMERCIALIZATION_DRAFT.md v0.1`  
> 审查时间：2026-08-24  会审方式：5 轨 subagent 并行（A架构 / B安全 / C通用UX / D合规 / EDevOps）  
> 结论：**5 轨一致「有条件通过」**——方向正确，估时乐观、口径不自洽、清单不完整，需修订后定版。

## 1. 汇总结论

| 轨 | 结论 | 一句话 |
|---|---|---|
| A 架构 | 有条件通过 | 上帝组件耦合度被低估，Worker/虚拟化成本未计，Phase1 1-2月高风险 |
| B 安全 | 有条件通过 | “不上传” vs `logger POST /log` 自洽破裂，掩码≠匿名，导入侧污染未闭环 |
| C 通用UX | 有条件通过 | 零代码未闭环（暴露技术模型）、`FieldConfig` 不完整、5分钟指标不可测 |
| D 合规 | 有条件通过 | OpenCore 自洽但商标边界不清，Phase0 漏 4份MD+Scorecard 必备 |
| E DevOps | 有条件通过 | 70%覆盖率不可直接落地，ghcr 假推送，action 未 pin |

**PM 裁决**：接受全部阻塞项，修订为 **v1.0** 后进入执行；Phase0 准出加严，Phase1 虚拟化/Worker 降级为 P1。

## 2. 阻塞问题 Top 10（去重后）

1. **口径矛盾**：`logger.ts:34 POST /log` 默认外发 vs `README.md:217` “不会上传服务器”——B/E 共同指出
2. **PII 假名化**：`storage.ts:22` 保留后4位仍算 PII，`storage.ts:18` 正则过窄，`storage.ts:116` 静默降级 localStorage ——B
3. **导入污染**：`fileParser.ts:48 raw={}` 非 `Object.create(null)`，深层 `__proto__` 未递归——A/B
4. **上帝组件成本低估**：`App.tsx:17 729行` 13state+6ref 需状态机+单测先行，工期 ×1.5-2——A
5. **零代码断崖**：`ConfigBuilder.tsx:39` 暴露 `idField/statusField` 技术术语，无 3 步向导——C
6. **FieldConfig 不完整**：`multiline` 与 `type` 重复，缺 `filter` 联动 `FilterBar.tsx:48`——C/A
7. **合规清单缺口**：缺 `CODE_OF_CONDUCT/GOVERNANCE/SUPPORT/CHANGELOG` + `permissions/pin/dependabot/scorecard`——D/E
8. **品牌未收敛**：`package.json:29` 等仍硬编码 Rebuild-Z，`scripts/rebrand.sh` 未落地——D
9. **CI 假门禁**：`ci.yml:57 push:false` vs `release.yml:31` 声称 ghcr 可拉，`coverage 47.98%→70%` 跳变——E/A
10. **指标不可测**：“5分钟80%”未定义被试/计时/成功判据——C/E

## 3. 采纳修订（v0.1 → v1.0 变更）

| 类别 | v0.1 | v1.0 变更 |
|---|---|---|
| 安全口径 | “隐私本地” 一句话 | `logger` 默认 `disabled`，需 `VITE_ENABLE_LOG=1` 显式开启，文档同步诚实化；PII 提供 `mask/strip/none` 三档，默认 `strip` 导出前二次确认 |
| 存储 | 静默迁移 localStorage | 移除 `getFallbackStorage` 静默降级/迁移，需用户确认；`sensitiveKeys` 可配 `config.sensitiveKeys` |
| 污染防护 | 提及 `Object.create(null)` | 明确 `fileParser` 统一 `Object.create(null)` + 递归 `sanitizeConfigData` + `zod.superRefine` 防 `__proto__` |
| 架构 | Worker/虚拟化列为 Phase1 必做 | 降为 P1：Phase1 仅做 `uniqueValuesMap memo + exportIdle` 保留，Worker/虚拟化移至 Phase1.5，需先过 `useConfig/useFilters` 小步拆分与单测 |
| 通用 | 1 句列映射 | 细化 3 步向导：上传→映射表（自动匹配+未匹配建新字段+重命名冲突预览）→Diff/撤销；`DEFAULT_CONFIG` 改 `generic.json` 最小模板+画廊，首次上传强制触发 |
| FieldConfig | `type/options/width` | `type` 收敛 `multiline→textarea`，新增 `filter: exact/range/search` 与 `boolean/currency/phone`，明确与 `FilterBar` 联动 |
| 合规 | 6份MD | 补齐 8份：`SECURITY/CODE_OF_CONDUCT/SUPPORT/TRADEMARK/GOVERNANCE/CHANGELOG/PRICING/NOTICE`，DCO 替代 CLA，`dependabot.yml+codeql+scorecard.yml+SBOM` |
| 品牌 | TODO | `scripts/rebrand.sh` 交付物化，`package.json` 改占位 `<<ORG>>` |
| CI | 70% 一步到位 | 阶梯：Phase0 `50% 阻塞 + 70% 告警`，Phase1 再 70% 阻塞；加 `concurrency/permissions/audit/pin SHA`，`docker/.dockerignore`，真推 `ghcr.io` with provenance |
| 度量 | 模糊 | 新增 SLA：`10k行解析 P95<2s / INP<200ms / 导出10k<1s` + Lighthouse CI；“5分钟”改为 `n≥15 外部HR录屏，独立完成导入-映射-筛选-导出，SUS≥70` |
| xlsx | 锁定 0.20.3 | 修正：`audit high=0` 门禁 + `sanitize` 暂缓替换，`exceljs` 为 Feature Flag 灰度分支 |

## 4. 未采纳 / 延后

- 虚拟化与分页二选一未裁决→ 延至 Phase1.5，按实测数据决策
- PWA 归属（Community vs Enterprise）→ 保持“计划中”诚实文案，Phase1 仅技术预研

## 5. 下一步

- 定版 `docs/PLAN_COMMERCIALIZATION.md v1.0`（本纪要附录）
- 建 GitHub Milestone `Phase0/1/1.5/2` + 拆 Issue（见 v1.0 §7）
- 5 轨 subagent 按 v1.0 领任务，PM 日更 `REVIEW_LOG`

*会审员签名：A/B/C/D/E subagent 2026-08-24*
