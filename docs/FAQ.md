# FAQ — 常见问题（≥10 条）

> 覆盖：通用性 · 隐私 · 列映射向导 · i18n · 部署与配置。未覆盖请提 `Issue`（`bug_report.yml / feature_request.yml`）。

## 1. 通用性

### Q1. 宣称“通用”，是否仍为黑客松定制？

**A.** 否。`public/config.json` 与 `src/types.ts:DEFAULT_CONFIG` 已为 **generic 最小模板**（`编号/姓名/邮箱/状态 4列`），原 hackathon 下沉至 `public/config-examples/hackathon.json`。通过 `public/config-examples/` 画廊（`generic / hackathon / campus-recruit / scholarship / vendor`）或页面顶部 **配置画廊** 下拉可一键切换；任意表单只需改 `public/config.json` 或在界面上传配置 JSON 即可适配，无需改代码。

### Q2. 一个 JSON 如何适配任意表单？

**A.** 编辑 `ViewConfig`（见 `README:ViewConfig 完整字段`）：

```json
{
  "title": "2024 校招面试评审",
  "idField": "候选人ID",
  "nameField": "姓名",
  "listFields": [{ "key": "姓名", "label": "姓名" }, { "key": "应聘岗位", "label": "岗位" }],
  "detailGroups": [{ "label": "基本信息", "fields": [{ "key": "手机", "label": "电话" }] }],
  "statusField": "审核状态",
  "statusValues": [{ "value": "", "label": "待定" }, { "value": "通过", "label": "通过", "color": "green" }]
}
```

`key` 必须与 Excel 表头一致；不一致会触发列映射向导（见 Q7）。`FieldConfig` 支持 `type/options/width/sortable/searchable/required/filter` 等通用化扩展（`src/types.ts`），`sensitiveKeys` 可配敏感列。

### Q3. 表头与配置 `key` 不一致（如 `手机号` vs `手机`）怎么办？

**A.** 会自动弹出 **列映射向导**（`src/components/ColumnMappingModal.tsx`）。可在向导中手动将 Excel 表头映射到正确 `key`，或勾选“新建字段”将其作为新列加入配置；确认后配置自动保存并提示撤销方式（见 Q8）。

---

## 2. 隐私与数据安全

### Q4. 上传的 Excel 是否会上传到服务器？

**A.** 不会。数据仅在浏览器 `sessionStorage` 处理（`src/utils/storage.ts`），关闭标签页自动清除；`logger.ts: POST /log` 默认 **禁用**，需显式 `VITE_ENABLE_LOG=1` 才上报。示例 `public/example.csv` 已脱敏（`138**** / example@test.com / wxid_fake`），`npm run build` 后 `dist/example.csv` 自动删除，不随发版外泄。详见 `README 🔒 隐私与数据说明`。

### Q5. 隐私策略有几档？敏感字段如何定义？

**A.** 三档（与 `storage.ts` 一致）：`mask`（掩码后 4 位外 `*`）、`strip`（导出前二次确认剥离）、`none`（不处理）；默认 `strip`。敏感键默认 `手机|邮箱|微信|phone|mail|tel|mobile|wechat` 且可配 `ViewConfig.sensitiveKeys`；`logger.ts` 额外覆盖 `id`（学号/工号）。上报路径均 `redactContext` 掩码。

### Q6. `xlsx@0.18.5` 有漏洞，是否安全？

**A.** 已知 `Prototype Pollution / ReDoS`（见 `README ⚠️ 依赖与诚实性说明` 与 `package.json:_comment_xlsx`）。当前通过 `fileParser.ts / config.ts: sanitizeConfigData` 递归过滤 `__proto__/constructor/prototype`、导入侧清洗 `^[=+\-@|%]` 公式、`zod.superRefine` 防污染来缓解；`npm audit --audit-level=high` 在 CI 门禁 `high=0`。生产加固可替换 `exceljs`（需改 `src/utils/fileParser.ts`），仓库已预留 Feature Flag 分支，非阻塞。

---

## 3. 列映射向导

### Q7. 何时会弹出列映射向导？自动匹配规则是什么？

**A.** 当上传文件的表头与当前 `ViewConfig` 的 `key` 集合（`listFields + detailGroups + idField/nameField/statusField` 并集）存在 **未匹配** 时触发；按 `src/components/ColumnMappingModal.tsx:autoMatchHeader` 规则：**完全相等** 或 **包含匹配（大小写不敏感）**（如 `姓名` 匹配 `真实姓名`，`邮箱` 匹配 `电子邮箱`）自动填充，其余标为“未匹配”。也可在上传后通过向导手动调整。

### Q8. 向导有几步？如何撤销？

**A.** 3 步：`① 字段映射`（每列 Excel 头 → 目标 `key`，下拉可选“不映射/后续新建”）→ `② 新建字段`（勾选未匹配头作为新字段，inline 编辑 `label`）→ `③ Diff 预览`（`新增/映射/直连/忽略` 四类汇总，`新增/映射/忽略` 计数与前 3 项 label 展示）。**撤销**：确认前点“取消”不生效；确认后可在顶部 **配置构建器** 删除字段或重新加载示例配置回滚；`Ctrl+Z` 仅撤销状态变更，不撤销映射。

### Q9. 重命名/去重冲突如何处理？

**A.** 向导中 `② 新建字段` 的 `label` 输入框可重命名，`③ Diff 预览` 会展示 `新增 {count} 列：{labels}` / `映射 {count} 列：{h}→{k}` / `忽略 {count} 列`，重复 `key` 在 `config.ts:getConfigValidationErrors` 校验时会报 `value 重复`；`autoMatchHeader` 对重复表头在 `fileParser.ts` 直接抛错“重复表头”。建议向导中保持 `key` 唯一，必要时在配置构建器中改 `key/label`。

---

## 4. i18n（国际化）

### Q10. 支持哪些语言？如何切换？

**A.** `zh`（默认，`fallbackLng: 'zh'`）与 `en`，`src/i18n.ts` 基于 `i18next + react-i18next`，`localStorage:app-locale` 持久，`prefix/suffix: { }` 兼容历史 `{current}/{total}` 插值。页面顶部 **中 / EN** 按钮（`role="group" aria-label="切换语言"`）点击即 `setLocale('zh'|'en')` 并重渲染；也可 `import { setLocale } from './i18n'` 或 `const { i18n } = useTranslation(); i18n.changeLanguage('en')`。`src/locales/zh.json / en.json` 70+ 词条严格对照。

### Q11. 新增页面如何接入 i18n？缺失 key 会怎样？

**A.** 在组件中：

```tsx
import { useTranslation } from 'react-i18next';
function FilterBar() {
  const { t } = useTranslation();
  return <input placeholder={t('search.placeholder')} />
         // 插值：t('pagination.page', { current: 1, total: 5 }) -> "第 1 / 5 页" / "Page 1 / 5"
}
// 非组件：import { t } from './i18n'; t('header.clearCacheConfirm')
```

缺失 `key` 时 `i18next` 先回退 `zh`，再回退 `key` 本身，不会白屏。存量硬编码可 `grep -rn "[\u4e00-\u9fff]" src` 定位后替换为 `t('key')` 并在两份 `locales/*.json` 补齐；需复数/命名空间直接 `useTranslation('ns')` 即可。

### Q12. 浏览器语言如何决定初始语言？

**A.** `src/i18n.ts:resolveInitialLocale` 优先 `localStorage:app-locale`，否则 `navigator.language` 以 `en` 开头则 `en`，其余 `zh`；`languageChanged` 时写入 `localStorage` 并派发 `locale-change` 兼容旧订阅。首次访问英文浏览器自动 `EN`，可在页面切换后持久覆盖。

---

## 5. 部署与配置

### Q13. 部署需要后端吗？支持哪些平台？

**A.** 不需要，纯静态 `dist`。支持 **Vercel / Netlify / Cloudflare Pages / GitHub Pages / Docker** 四路（见 `docs/DEPLOY.md`）：`npm run build` 后将 `dist` 部署即可；`Vercel/Netlify` 有一键按钮，`Cloudflare Pages` 选 `Vite` 预设，`GitHub Pages` 需 `base: '/<repo>/'` 或 `cp dist/index.html dist/404.html` 处理 SPA 回退，`Docker` 用 `docker/Dockerfile + nginx.conf`。

### Q14. 远程配置 `?config=https://...` 为何不生效？

**A.** 默认 **同源限制**（`src/config.ts:ALLOWED_ORIGINS = [location.origin]`），跨域会被 `reportWarn('远程配置仅允许同源')` 并回退本地/默认配置。私有化需在 `src/config.ts:14` 显式加入可信域（如 `https://config.your-org.com`），并确保配置域返回 `Access-Control-Allow-Origin: <页面 origin>`，否则 `mode:'cors'` 报 `CORS或网络错误`。超时 5s，失败回退 `sessionStorage` 缓存。

### Q15. `VITE_ENABLE_LOG` 是什么？何时开启？

**A.** `src/utils/logger.ts` 仅当 `VITE_ENABLE_LOG=1` 时才 `fetch('/log')` 上报，否则完全不执行（与 `README 🔒` 一致）。有 `window.SENTRY` 时优先 `SENTRY.captureException`，否则 `POST /log`；所有路径对敏感 `key` 掩码。默认 `0`，仅需自建 `/log` 接收端或排查时在 Vercel/Netlify 控制台设 `VITE_ENABLE_LOG=1` 后重建。

### Q16. 离线可用（PWA）是否已支持？

**A.** **未启用，诚实标注“计划中”**。`vite.config.ts:6-7` 未集成 `vite-plugin-pwa`，`README 特性` 写作 `离线可用（计划中）`。如需启用：`npm i -D vite-plugin-pwa` 并在 `vite.config.ts:plugins` 加 `VitePWA({ registerType: 'autoUpdate' })`，`Enterprise` 规划中提供离线审核能力，企业版详见 `docs/ROADMAP.md §5`。

---

*更多：`docs/DEPLOY.md` 部署排错 · `docs/ROADMAP.md` 版本规划 · `docs/PLAN_COMMERCIALIZATION.md v1.0` 商业化总体计划。*
