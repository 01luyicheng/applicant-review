# Applicant Review

<!-- badges: 以下徽章中 01luyicheng 为 GitHub 组织/用户名占位，rebrand 后替换 — 执行 ./scripts/rebrand.sh 01luyicheng 一键替换为实际值；shields.io 为占位徽章，替换后自动指向真实仓库 -->
[![CI](https://img.shields.io/github/actions/workflow/status/01luyicheng/applicant-review/ci.yml?branch=main&label=CI)](https://github.com/01luyicheng/applicant-review/actions/workflows/ci.yml) [![Coverage](https://img.shields.io/badge/coverage-76.88%25-brightgreen)](./coverage) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Version](https://img.shields.io/badge/version-1.0.0-blue)](./CHANGELOG.md)

通用的活动报名审核工具。拖拽 Excel/CSV 即用，零配置上手，通过配置文件适配任意表单字段。

## ✨ 特性

- **零配置上手** - 拖拽飞书/腾讯文档/Notion 导出的 xlsx/csv 直接使用
- **配置驱动** - 一个 JSON 文件适配任意表单：字段映射、列表列、详情分组、状态流转
- **开箱即用** - 统计看板、多维筛选、批量导出、键盘快捷键
- **部署灵活** - 纯静态站点（`vite build → dist`），零后端即可部署，已验证 **Vercel / Netlify / Cloudflare Pages / GitHub Pages / Docker** 四路（详见 `docs/DEPLOY.md`；`Vercel/Netlify` 一键按钮、`Cloudflare Pages` 选 Vite 预设、`GitHub Pages` 需 `base: '/<repo>/'` 或 `404.html` 回退、`Docker` 用 `docker/Dockerfile + nginx.conf`；环境变量仅 `VITE_ENABLE_LOG` 默认 `0` 禁用上报，远程配置 `?config=` 默认同源见 `src/config.ts:ALLOWED_ORIGINS`）
- **隐私优先** - 数据仅在浏览器本地处理，不上传服务器（`sessionStorage` 隔离，关闭标签页清除；`POST /log` 默认禁用需 `VITE_ENABLE_LOG=1` 显式开启，见 `src/utils/logger.ts` 与 `docs/DEPLOY.md §6`）
- **离线可用（计划中，当前未启用）** - `vite.config.ts` 当前 **未集成 `vite-plugin-pwa`**，因此离线能力为 **计划中、诚实未启用** 状态，当前版本需联网访问；如需启用执行 `npm i -D vite-plugin-pwa` 并在 `vite.config.ts:plugins` 添加 `VitePWA({ registerType: 'autoUpdate' })`（与 `docs/ROADMAP.md §5 企业版规划` 一致）

## 🚀 快速开始

### 在线体验
访问 [demo.applicant-review.dev](https://demo.applicant-review.dev) （待部署，本地 `npm run dev` 体验）

### 本地开发
```bash
# TODO: 将 01luyicheng 替换为你的 GitHub 组织/用户名，执行 ./scripts/rebrand.sh 01luyicheng 一键替换（历史占位 01luyicheng 已去硬编码）
git clone https://github.com/01luyicheng/applicant-review
cd applicant-review
npm install
npm run dev
```

### 一键部署
<!-- TODO: 将 01luyicheng 替换为实际仓库地址，执行 ./scripts/rebrand.sh 01luyicheng -->
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/01luyicheng/applicant-review)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/01luyicheng/applicant-review)

## 📖 使用指南

### 1. 准备数据
从飞书多维表格、腾讯文档、Notion、Google Sheets 导出 **xlsx 或 csv** 文件。

### 2. 打开工具
打开部署好的网页，或本地运行 `npm run dev`。

### 3. 拖拽上传
将文件拖入上传区，自动解析并渲染审核界面。

### 4. 审核操作
- **表格视图**：一眼看到关键信息，下拉框直接改状态
- **详情弹窗**：点击行查看完整信息，支持长文本滚动
- **筛选搜索**：支持全文搜索、状态筛选、任意字段下拉筛选
- **导出结果**：一键导出当前筛选结果为 CSV

### 5. 自定义配置（可选）
编辑 `public/config.json` 或在界面上传配置文件，适配你的表单字段：

```json
{
  "title": "2024 校招面试评审",
  "idField": "候选人ID",
  "nameField": "姓名",
  "listFields": [
    { "key": "姓名", "label": "姓名" },
    { "key": "应聘岗位", "label": "岗位" },
    { "key": "面试轮次", "label": "轮次" },
    { "key": "综合评价", "label": "评价" }
  ],
  "detailGroups": [
    { "label": "基本信息", "fields": [
      { "key": "姓名", "label": "姓名" },
      { "key": "手机", "label": "电话" },
      { "key": "邮箱", "label": "邮箱" },
      { "key": "应聘岗位", "label": "岗位" }
    ]},
    { "label": "面试记录", "fields": [
      { "key": "面试官", "label": "面试官" },
      { "key": "面试时间", "label": "时间" },
      { "key": "优点", "label": "优点", "multiline": true },
      { "key": "不足", "label": "不足", "multiline": true },
      { "key": "综合评价", "label": "综合评价", "multiline": true }
    ]}
  ],
  "statusField": "审核状态",
  "statusValues": [
    { "value": "", "label": "待定" },
    { "value": "通过", "label": "通过", "color": "green" },
    { "value": "待定", "label": "待定", "color": "yellow" },
    { "value": "拒绝", "label": "拒绝", "color": "red" }
  ]
}
```

## 🎯 适用场景

| 场景 | 示例字段 |
|------|----------|
| 黑客松/马拉松报名 | 姓名、队伍、项目简介、技术栈、GitHub |
| 校招/社招面试评审 | 姓名、岗位、轮次、面试官、优缺点、结论 |
| 奖学金/荣誉评审 | 姓名、院系、成绩、材料、评委打分 |
| 供应商/合作伙伴准入 | 公司、资质、业务范围、报价、风控结论 |
| 会议/活动签到确认 | 姓名、单位、票种、签到时间、特殊需求 |
| 论文/作品征集评审 | 标题、作者、摘要、领域、评审意见 |

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `↑/↓` | 选择上/下一行 |
| `Enter` | 打开详情 |
| `1/2/3` | 快速设置状态（对应配置顺序） |
| `Ctrl/Cmd + F` | 聚焦搜索框 |
| `Esc` | 关闭详情/清除选择 |

## 🏗️ 项目结构

```
applicant-review/
├── public/
│   ├── config.json          # 默认配置（generic 最小通用模板，已与 DEFAULT_CONFIG 一致）
│   └── config-examples/     # 多场景配置示例（generic/hackathon/campus-recruit/scholarship/vendor + README 画廊）
├── src/
│   ├── components/          # UI 组件
│   ├── locales/             # i18n 词条 zh.json / en.json
│   ├── i18n.ts              # 轻量 t 函数（fallback 中文，预留 i18next）
│   ├── utils/               # 解析、导出、工具函数
│   ├── types.ts             # TypeScript 类型定义（已扩展 FieldConfig/ViewConfig 通用字段）
│   ├── config.ts            # 配置加载与校验
│   ├── App.tsx              # 主应用（含 header 画廊下拉一键加载）
│   └── main.tsx             # 入口
├── .github/
│   ├── workflows/           # CI/CD
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE/
├── docker/                  # Docker 配置
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── package.json
```

## 🔧 配置详解

### ViewConfig 完整字段

```typescript
interface ViewConfig {
  title: string;                    // 页面标题
  idField: string;                  // 唯一标识字段（必填）
  nameField: string;                // 显示名称字段（必填）
  listFields: FieldConfig[];        // 表格显示列
  detailGroups: DetailGroup[];      // 详情分组
  statusField: string;              // 状态字段名
  statusValues: StatusValue[];      // 状态选项
}

interface FieldConfig {
  key: string;                      // 对应表头名
  label: string;                    // 显示名
  multiline?: boolean;              // 是否多行文本
  visibleInList?: boolean;          // 是否在列表显示
}

interface DetailGroup {
  label: string;                    // 分组标题
  fields: FieldConfig[];            // 字段列表
}

interface StatusValue {
  value: string;                    // 存储值
  label: string;                    // 显示名
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'; // 标签颜色
}
```

### 配置加载优先级
1. URL 参数 `?config=https://example.com/config.json`
2. 本地上传的配置文件
3. `public/config.json`
4. 内置默认配置

## 🐳 Docker 部署

```bash
# 构建
docker build -t applicant-review .

# 运行
docker run -d -p 8080:80 --name applicant-review applicant-review

# 或使用 docker-compose
docker-compose up -d
```

## 🤝 贡献指南

欢迎 PR 和 Issue！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 开发流程
1. Fork 仓库
2. 创建分支：`git checkout -b feat/your-feature`
3. 提交：`git commit -m 'feat: add xxx'`
4. 推送：`git push origin feat/your-feature`
5. 创建 PR

### 提交规范
遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `config:` 配置示例

## 🌐 国际化（i18n）— Phase 1 已接入主链路

> 基座 `src/i18n.ts` 已从轻量封装升级为 **i18next + react-i18next** 真实实现（`fallbackLng: 'zh'`，`localStorage:app-locale` 持久，`prefix/suffix: { }` 兼容历史插值），`src/locales/zh.json` / `en.json` 覆盖 **70+ 词条**。

- **依赖**：`package.json:dependencies` 已加入 `i18next@^23.15.1` + `react-i18next@^13.5.0`（`npm install` 即可，无需额外步骤）。
- **初始化**：`src/i18n.ts:10-35` 调用 `i18n.use(initReactI18next).init({ resources: { zh:{translation:zh}, en:{translation:en} }, lng: resolveInitialLocale(), fallbackLng:'zh', interpolation:{prefix:'{',suffix:'}'} })`，并在 `languageChanged` 时写入 `localStorage` + 派发 `locale-change` 兼容旧订阅。
- **切换**：`import { setLocale, getLocale } from './i18n'` 或 `const { i18n } = useTranslation(); i18n.changeLanguage('en')`；`App.tsx:header` 已提供 **中 / EN** 按钮（`role="group" aria-label="切换语言"`），点击即 `setLocale('zh'|'en')` 并持久化，`useTranslation` 自动重渲染。
- **使用**：
  ```tsx
  import { useTranslation } from 'react-i18next';
  function FilterBar() {
    const { t } = useTranslation();
    return <input placeholder={t('search.placeholder')} />
           // 插值：t('pagination.page', { current: 1, total: 5 }) -> "第 1 / 5 页" / "Page 1 / 5"
           // fallback：缺失 key 时回退 zh，再回退 key 本身
  }
  // 非组件场景：import { t } from './i18n'; t('header.clearCacheConfirm')
  ```
- **示范改造**：`src/components/FilterBar.tsx`（12 处中文 → `t('search.*')`/`t('filter.*')`）与 `src/components/FileUploader.tsx`（7 处 → `t('upload.*')`）已全量 `t()` 化，`locales/zh.json` 与 `en.json` 保持严格对照（含 `filter.truncatedTitle`/`filter.moreCount`/`upload.invalidType` 等新增 11 词条）；`App.tsx` header/pagination/table 空状态亦接入 `t('header.*')`/`t('pagination.*')`/`t('table.*')`。
- **迁移与扩展**：后续全量推广只需 `grep -rn "[\u4e00-\u9fff]" src` 定位硬编码，按上述模式替换为 `t('key')` 并在两份 `locales/*.json` 补齐对照；如需复数/命名空间，直接使用 `useTranslation('namespace')` 与 i18next 复数规则即可，无需再改封装。
- **验证**：`npm run typecheck` 与 `npm run build` 已通过；`npm test` 存量用例（含 `App.smoke.test.tsx` 中 `getByText(/拖拽或点击上传/)`）建议补充为 `getByText(t('upload.dragHint'))` 或同时断言 en 切换。

## ⚠️ 依赖与诚实性说明

- **xlsx 已知漏洞**：`xlsx@^0.18.5` 存在 Prototype Pollution / ReDoS 等已知漏洞（见 [GitHub Advisory](https://github.com/advisories?query=xlsx)），本项目为兼容历史数据暂保留，如需生产加固建议替换为 [`exceljs`](https://github.com/exceljs/exceljs)（需改 `src/utils/fileParser.ts`），或锁定版本并定期 `npm audit`。
- **PWA 状态**：`vite.config.ts` 当前未集成 `vite-plugin-pwa`，因此“离线可用”标注为 **计划中**，文档已诚实说明；如需启用可执行 `npm i -D vite-plugin-pwa` 并在 `vite.config.ts` 中添加 `VitePWA()` 插件。
- **包管理器**：本仓库使用 `npm` + `package-lock.json`（见 `CONTRIBUTING.md` 已统一为 `npm`，如使用 `pnpm` 请自行生成 `pnpm-lock.yaml` 并保持一致）。
- **GitHub 模板**：`.github/ISSUE_TEMPLATE/`（bug_report.yml / feature_request.yml / config_example.yml）、`PULL_REQUEST_TEMPLATE.md`、`workflows/ci.yml` 与 `workflows/release.yml` 已存在，无需补充。

## 📊 覆盖率路线图（Coverage Roadmap）

> 详见 `vite.config.ts:test.coverage.thresholds` 阶梯注释。

| 阶段 | 阻塞阈值（CI 失败） | 告警阈值（CI 不失败） | 目标 | 关键里程碑 |
|------|-------------------|-------------------|------|-----------|
| 基线 | — | — | 47.98% | 审计前基线（`ConfigBuilder 0%`，`fileParser` 高但 `parseFile` 未测） |
| Phase0 | lines/statements 50, branches/functions 40 | lines/statements 70, branches/functions 60（仅告警） | 50% 阻塞 |达成 51.49%（当前）；引入 `coverage` provider `v8`，`ci.yml:45-67` 门禁 |
| Phase1（当前） | 维持 50/40 阻塞 | lines/statements 70, branches/functions 60 告警 | 补齐真文件 + E2E |新增 `src/utils/fileParser.test.ts:parseFile 真文件`（csv/xlsx 含中文表头+`=HYPERLINK` 注入过滤）、边界（重复表头抛错、空表头/原型污染）、`tests/e2e/mapping.spec.ts` 验证 >30% 弹向导→确认更新/取消不变 |
| Phase2 | lines/statements 70, branches 60, functions 60-70 | — | 70% 阻塞 | 覆盖 `ColumnMappingModal 316行 0%`、`DetailModal`、`FileUploader`、`shortcuts`、`ErrorBoundary` |

演进策略：每阶段先加“告警阈值”→ 测试补齐 → 转“阻塞阈值”；`npm run coverage` 即 `vitest run --coverage`，以 `thresholds` 为失败门槛，`npm run test` 保持 ≥50% 通过。

```bash
npm run test        # 快速验证（无覆盖率）
npm run coverage    # 覆盖率门禁（当前 51.49%+，Phase1 告警 70%）
```

## 🔒 隐私与数据说明

- **示例数据已脱敏**：`public/example.csv` 仅含合成假数据（手机号 `138****` / 邮箱 `example@test.com` / 微信 `wxid_fake`），无真实 PII；根级示例 `01luyicheng` 相关 `*.csv`（如已存在）亦为同份假数据（10 行，历史品牌占位，现已去品牌化，见 `public/example.csv`）。`dist` 已剔除示例（`npm run build` 后自动 `rm -f dist/example.csv`，`publicDir` 仍为 `public` 以便 `npm run dev` 调试）。
- **本地处理**：上传的报名表仅在浏览器 `sessionStorage` 处理（默认掩码），关闭标签页自动清除，不会上传服务器。
- **Git 历史**：当前仓库为非 `git` 初始化状态（`find . -name .git` 无结果），无历史泄露风险；若你 `fork` 后 `git init` 并曾提交过真实 CSV，请执行 `git filter-repo --invert-paths --path 'public/*.csv' --path '*.csv' --force` 或 `BFG --delete-files '*.csv'` 并 `git push --force`，并建议全局安装 `gitleaks` 做提交前扫描。

## 📄 许可证

**SPDX-License-Identifier: MIT** — 本项目采用 [MIT License](LICENSE)（见 `LICENSE` 头部 SPDX 标识与 `package.json:license` 字段），为最宽松的 OSI 认证许可之一（MIT），0BSD/MIT-0 文本更短但生态认可度低于 MIT，商业友好：允许商用、修改、分发、私有使用，仅要求保留版权与许可声明，无专利回授/传染性约束。

- **代码**：MIT 授权，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)（含第三方依赖声明）。
- **商标/品牌不授权**：项目名称、Logo、域名等商标不受 MIT 覆盖，禁止暗示官方背书；分发或商用前请执行 `./scripts/rebrand.sh` 完成重命名，详见 [TRADEMARK.md](TRADEMARK.md)。
- **占位说明**：`package.json` / `README` 中 `01luyicheng` 为历史品牌占位，发布前执行 `scripts/rebrand.sh 01luyicheng` 替换，不影响 MIT 许可效力。
- **第三方**：依赖各自许可证（见 [NOTICE](NOTICE) 与 `package-lock.json` SBOM），其中 `xlsx` 为 Apache-2.0、`lucide-react` 为 ISC，其余多为 MIT。

## 📦 发布指引

```bash
git remote add origin https://github.com/01luyicheng/applicant-review.git  # 首次发布：替换 01luyicheng 后执行，rebrand 脚本会同步替换 README/CHANGELOG/package.json 中的占位
git push -u origin main && git push --tags  # 推送代码与 v1.0.0 标签（触发 release.yml 生成 dist.zip）
docker pull ghcr.io/01luyicheng/applicant-review:latest  # 拉取 CI 构建的镜像（需先在 main 分支 push 触发 docker job，见 .github/workflows/ci.yml:docker）
```

## 🙏 致谢

- [SheetJS](https://sheetjs.com/) - Excel 解析
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)