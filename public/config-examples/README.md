# 配置画廊（Config Gallery）

本目录提供开箱即用的行业模板，通过 `public/config.json` 或界面切换即可适配任意表单。

## 画廊索引（5 个示例）

| # | 文件 | 适用场景 | 核心字段举例 | 状态流示例 |
|---|------|----------|--------------|------------|
| 1 | `generic.json` | **通用最小模板 / 活动报名审核** | 姓名、邮箱、手机号、状态、备注 | 待审核 → 通过/拒绝 |
| 2 | `hackathon.json` | 黑客松/创客马拉松报名审核 | 姓名、昵称、赛道、想法、技术栈 | 待审核/通过/拒绝/候补 |
| 3 | `campus-recruit.json` | 校招/社招面试评审 | 姓名、岗位、轮次、面试官、综合评价 | 待定/通过/拒绝/发Offer |
| 4 | `scholarship.json` | 奖学金/荣誉评审 | 学生姓名、院系、班级、综测、奖学金类别 | 待初审→初/复/终审通过/不通过 |
| 5 | `vendor.json` | 供应商/合作伙伴准入评审 | 供应商名称、业务范围、注册资本、风控结论 | 待评审→准入通过/条件通过/不准入/黑名单 |

> 提示：`generic.json` 为最小可复用模板，已同步为 `public/config.json` 与 `src/types.ts:DEFAULT_CONFIG`，保持诚实（不再硬编码黑客松长问）。

## 一键加载说明

### 方式 A：Header 下拉（推荐，已在 App.tsx 实现）

1. 顶部导航右侧「示例配置」下拉框
2. 选择对应模板 → 自动 `fetch('/config-examples/<name>.json')` 并校验
3. 成功后 `saveConfig()` 并清空旧数据缓存，提示重新上传 Excel/CSV
4. 失败则回退并提示 `configError`

示例函数（`src/App.tsx` 内）：

```ts
// TODO(Phase1): 抽为 hooks/useGalleryConfig
const EXAMPLES = [
  { value: 'generic', label: '通用模板', path: '/config-examples/generic.json' },
  { value: 'hackathon', label: '黑客松', path: '/config-examples/hackathon.json' },
  { value: 'campus-recruit', label: '校招面试', path: '/config-examples/campus-recruit.json' },
  { value: 'scholarship', label: '奖学金', path: '/config-examples/scholarship.json' },
  { value: 'vendor', label: '供应商准入', path: '/config-examples/vendor.json' },
] as const;

async function loadExampleConfig(path: string) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const json = await res.json();
  const errors = getConfigValidationErrors(json);
  if (errors.length) throw new Error(errors.join('；'));
  saveConfig(json);
  setConfig(json);
  clearApplicants(); // 画廊切换视为新活动，需重新上传
}
```

### 方式 B：URL 参数

```
?config=/config-examples/vendor.json   # 同源远程配置，App.tsx 已支持
```

### 方式 C：手动上传

1. 点击筛选栏「切换配置」上传本地 `*.json`
2. 或直接替换 `public/config.json` 后重新部署

### 方式 D：FilterBar 扩展（预留 TODO）

如需在筛选栏展示画廊，可在 `src/components/FilterBar.tsx` 接收 `onLoadExample?: (path: string)=>void` 并渲染同款 `<select>`。

## 校验与兼容

- 所有模板均通过 `src/config.ts:validateConfig()` 校验
- 新增字段（`type/options/width/sortable/searchable/required/filter/sensitiveKeys`）均为可选，向后兼容
