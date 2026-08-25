# 手动走查清单（5 分钟，替代/补充 jsdom 烟雾）

> 本文档为 `src/App.smoke.test.tsx` 的真机补充：若 jsdom 集成过重或需人工复核，按此清单 5 分钟完成复审“未真机走查”覆盖。已在 jsdom 中通过 `render(<App/>)` + `File` + `fetch('/config.json')` mock 覆盖核心链路，此文档仅为人工复核指引。
> 当前基线：`App.tsx 208 行` hooks 拆分（`useConfig/useFilters/useApplicants/useHistory/useExport/useGallery/usePersistence/useKeyboardShortcuts`）、`generic 4 列`（`姓名/邮箱/状态/备注`）、Worker 解析（`src/workers/parseWorker.ts`）、PWA 已落地（`vite-plugin-pwa autoUpdate` + `sw.js`/`manifest.webmanifest`，`includeAssets:['config.json']`）、i18n 中EN（Header `中/EN` 切换）、`mappingThreshold` 可配（默认 0.3，`ViewConfig.mappingThreshold`）、zod 单源校验、Header `gallery`/`language` 按钮。

## 环境
```bash
npm install
npm run dev # 默认 http://localhost:3000
npm run typecheck # PASS
npm run coverage  # lines 76.85% / statements 72.73% / branches 63.19% / functions 70.71% · 14 files/128 passed + 3 todo · thresholds 70/70/60/70 阻塞已达成 · PWA 已落地（sw.js/manifest.webmanifest）
```
截图建议：对每个步骤截图标注（参考 `npm run dev` 后页面顶部 `配置构建器`、`上传文件`、`导出 CSV`、Header 右侧 `gallery` 下拉与 `中/EN` 语言切换）。

## 清单（generic 4 列起步 + Worker + 向导）

### 1) 上传 generic 示例（30s）
- 准备 `public/example.csv` 或 `public/config-examples/generic.json` 对应示例（`generic` 最小模板 4 列：`姓名/邮箱/状态/备注`；`detailGroups: 基本信息/审核状态`）。
- 操作：拖拽或点击页面中央 `拖拽或点击上传 .xlsx,.xls,.csv` 区域，选择 `example.csv`；或顶部 `gallery` 下拉切换 `generic/hackathon/campus-recruit/scholarship/vendor`。
- 预期：表格渲染行数 >0；顶部 StatsBar 显示 `总计 N / 通过 X / 拒绝 Y / 待审 Z`；无 `文件解析失败` 错误；控制栏出现 `导出 CSV` 按钮（enabled）。解析走 `Worker`（`src/workers/parseWorker.ts` + `src/utils/fileParser.ts:parseFile`），10s 超时自动回退主线程；`exceljs` 优先、`xlsx` 回退。
- 截图：标注上传区、表格首行、StatsBar、Header gallery/语言按钮。

### 2) 筛选（45s）
- 搜索：输入任意姓名片段（如 `张`），验证表格过滤为匹配行；清空后恢复全量。
- 状态筛选：下拉 `状态` 选择 `通过`，验证仅显示对应行；选择 `全部` 恢复。
- 自定义筛选：展开 `更多筛选`，选择任意一列值，验证联动过滤；点击 `清除筛选` 恢复。`FilterBar` 已 `memo` 缓存 `uniqueValuesMap`。
- 截图：标注搜索框、状态下拉、自定义筛选列。

### 3) 键盘 Tab → Enter 打开详情（30s）
- 用 `Tab` 聚焦第一行（`tabIndex=0`，`focus:ring` 可见），按 `Enter`。
- 预期：`DetailModal` 弹窗出现，标题为选中人 `真实姓名`（或 `config.nameField` 对应 label），状态 badge 按 `getStatusColor` 着色，分组详情可滚动；按 `Esc` 关闭，焦点回到原行。
- 截图：标注聚焦环、弹窗标题与关闭按钮 `×`。

### 4) 1 / 2 快速改状态（30s）
- 选中一行（点击或 `ArrowDown/ArrowUp` 切换高亮 `bg-blue-50`），按 `1` （对应 `statusValues[0]` 的非空值，如 `通过`）或 `2`（`拒绝`）。
- 预期：该行状态下拉与 badge 立即变为对应 label，底部 Toast 显示 `已改为通过，可撤销` 并出现 `撤销 (Ctrl+Z)` 按钮。状态写入 `useApplicants` 并 `queueStore` 持久化。
- 截图：标注选中行、状态下拉变化、Toast。

### 5) Ctrl+Z 撤销（20s）
- 在 Toast 可见或任意时刻，按 `Ctrl+Z`（或 `Cmd+Z`）。
- 预期：状态回退到修改前值，Toast 显示 `已撤销，恢复为...`；再次按 `Ctrl+Z` 可连续回退历史栈（`useHistory`）。
- 注意：焦点不在 `input/select/textarea` 内时才触发（FileUploader/FilterBar 输入框内按 `Ctrl+Z` 仅撤销输入，不触发业务撤销）。

### 6) 导出 CSV 并校验 BOM（30s）
- 点击 `导出 CSV`（右下控制栏），观察浏览器下载 `活动报名审核-YYYY-MM-DD.csv`。
- 校验：用 `hexdump -C` 或 `node -e "require('fs').readFileSync('xxx.csv').slice(0,3)"` 查看前 3 字节为 `EF BB BF`（UTF-8 BOM，`\uFEFF`），首行含 `序号`；Excel/WPS 直接打开中文不乱码。
- 代码侧：`src/hooks/useExport.ts:exportCSV` 中 `new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'})` 已固化，`src/App.smoke.test.tsx` 已用 `Blob.arrayBuffer()` 校验 `0xEF 0xBB 0xBF`；注入防护 `sanitizeCsvCell` 前置 `'` 处理 `= + - @ | %`。

### 7) 刷新后恢复（20s）
- 改完状态后等待约 600ms（`debounced queueStore` + `flush`），刷新页面。
- 预期：表格自动从 `sessionStorage` 恢复（`loadApplicants(DEFAULT_CONFIG.title)` 联动校验），之前修改的状态仍在；若 `config.title` 变更则提示 `检测到本地缓存与当前配置不一致，已忽略缓存` 并需重新上传。`vite-plugin-pwa` 已启用（`registerType: autoUpdate`，`includeAssets: ['config.json']`），离线仍可加载已缓存的 `dist + config.json`。
- 截图：标注刷新后仍保留的修改行；DevTools → Application → Session Storage → `applicant-review-data` 可见 `configTitle` 与 `savedAt`。

### 8) ConfigBuilder + 列映射向导 3 步（45s）
- **ConfigBuilder**：点击顶部 `配置构建器`，在弹窗中查看 `headers` 已自动提取自当前表格列（或 `config.listFields/detailGroups` 并集）。操作：勾选/改名若干列、拖动分组（`detailGroups` 分组增删/字段标签编辑）、修改 `statusValues` 颜色、切换 `visibleInList/sortable/searchable/type/filter/options`（`FieldConfig` 全量：`text/textarea/number/date/email/url/select/multiselect/attachment/rating/boolean/currency/phone`），保存。
  - 预期：`saveConfig(next)` 后提示 `配置已应用，原数据已清空请重新上传`，表格回到上传空状态；新配置持久化到 `localStorage`（`applicant-review-config`），刷新后标题/列头随新配置生效；校验走 `zod 单源`（`src/config.ts:configSchema` + `getConfigValidationErrors`），非法原型键与重复 `statusValues.value` 拦截。
  - 截图：标注 ConfigBuilder 弹窗、保存后 Toast、刷新后新标题。
- **列映射向导 3 步**：上传一个表头与当前 `config` 差异 > `mappingThreshold`（默认 `0.3` 即 30%，`ViewConfig.mappingThreshold` 可配）的文件，自动弹出 `ColumnMappingModal`。
  - 步骤 1 — 映射表：`autoMatchHeader` 完全相等/包含匹配，逐行选择目标 `configKeys`，显示 `已匹配/未匹配` badge。
  - 步骤 2 — 未匹配建新字段：勾选未匹配列转为新字段，编辑 `label` 重命名，去重冲突预览。
  - 步骤 3 — Diff/撤销预览：展示 `新增/已映射/忽略` 三类汇总，确认后 `onConfirm(mapping, createNewFields, newFieldLabels)` 更新 `config.listFields/detailGroups` 并重写 `applicants`；取消则保留原文件并提示 `已取消映射`。
  - 进度条 `33%→66%→100%`，`Esc` 关闭、焦点返回。
  - 截图：标注向导三步与进度条、Diff 汇总。

## 失败降级
- 若某步因环境（如 `jsdom` 无真机键盘时序）失败，测试侧已提供 `it.todo` 说明，可 `skip` 并在此文档记录原因与复现环境，不阻塞 `npm run test`（当前 `Test Files 14 passed / Tests 128 passed + 3 todo`，`coverage lines 76.85% / statements 72.73% / branches 63.19% / functions 70.71% · thresholds 70/70/60/70 阻塞已达成 · PWA sw.js/manifest 已落地`）。

## 关联自动化
- 自动化烟雾：`src/App.smoke.test.tsx` 已覆盖 `render(<App/>)` → `fetch('/config.json')` mock → `File([example.csv])` 触发 `FileUploader.onLoad` → 表格行数>0 → `onStatusChangeById` 改状态 → `loadApplicants` 恢复 → `exportToCSV` + BOM（`arrayBuffer` 前 3 字节 `EF BB BF`）。
- 列映射 E2E：`tests/e2e/mapping.spec.ts` 覆盖 `>threshold` 弹向导→确认更新/取消不变。
- 解析单测：`src/utils/fileParser.test.ts` 真文件（csv/xlsx 含中文表头/ `=HYPERLINK` 注入过滤/重复表头/原型污染） + Worker 回退。
- 运行：`npm run test -- src/App.smoke.test.tsx` 或 `npm run test` 全量；`npm run coverage` 看阈值（当前 `vite.config.ts:test.coverage.thresholds: lines 70 / branches 60 / functions 70 / statements 70` 阻塞已达成 lines 76.85% · 14 files/128 passed + 3 todo · PWA sw.js/manifest.webmanifest 已落地）。

## 截图占位
- `docs/screenshots/01-upload.png`：上传区 + generic 4 列表格 + gallery/语言按钮
- `docs/screenshots/02-filter.png`：搜索/状态/自定义筛选
- `docs/screenshots/03-detail.png`：Tab 聚焦 + Enter 弹窗
- `docs/screenshots/04-status.png`：1/2 改状态 + Toast
- `docs/screenshots/05-undo.png`：Ctrl+Z 撤销
- `docs/screenshots/06-export.png`：导出按钮与下载文件属性（含 BOM 校验终端输出）
- `docs/screenshots/07-reload.png`：刷新后恢复的 SessionStorage + PWA 离线可用
- `docs/screenshots/08-builder.png`：ConfigBuilder 弹窗（含 FieldConfig 扩展与 detailGroups）
- `docs/screenshots/09-mapping.png`：列映射向导 3 步（映射表/建新字段/Diff 预览，含 `mappingThreshold` 可配提示）

> 截图标注可用系统截图工具框选并文字说明关键按钮/状态；无需真浏览器之外的重型 Playwright，仅 `npm run dev` + 浏览器即可完成。PWA 离线验证：`npm run build && npm run preview` 后断网刷新仍可打开。
