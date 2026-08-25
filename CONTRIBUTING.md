# 贡献指南

感谢你的关注！我们欢迎任何形式的贡献。

## 开发环境

- Node.js >= 18
- npm >= 9（本仓库使用 `package-lock.json`，统一使用 npm；如需使用 pnpm 请先生成 `pnpm-lock.yaml` 并保持一致）

## 快速开始

```bash
# 克隆仓库
# TODO: 将 01luyicheng 替换为实际 GitHub 组织/用户名，执行 ./scripts/rebrand.sh 01luyicheng 一键替换（历史占位 01luyicheng 已去硬编码）
git clone https://github.com/01luyicheng/applicant-review
cd applicant-review

# 安装依赖（本项目使用 npm + package-lock.json）
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 目录结构

```
src/
├── components/     # React 组件
│   ├── ApplicantRow.tsx
│   ├── DetailModal.tsx
│   ├── FilterBar.tsx
│   ├── FileUploader.tsx
│   └── StatsBar.tsx
├── utils/          # 工具函数
│   ├── export.ts
│   ├── fileParser.ts
│   └── shortcuts.ts
├── config.ts       # 配置加载与校验
├── types.ts        # TypeScript 类型
├── App.tsx         # 主应用
└── main.tsx        # 入口
```

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加键盘快捷键支持` |
| `fix` | 修复 Bug | `fix: 修复 CSV 导出编码问题` |
| `docs` | 文档更新 | `docs: 补充配置示例说明` |
| `refactor` | 重构 | `refactor: 提取配置校验逻辑` |
| `config` | 配置示例 | `config: 新增奖学金评审配置` |
| `chore` | 构建/工具 | `chore: 升级依赖版本` |
| `test` | 测试 | `test: 添加解析器单元测试` |

提交信息格式：
```
<type>(<scope>): <subject>

<body>

<footer>
```

## 分支策略

- `main` - 稳定版本，保护分支
- `develop` - 开发分支
- `feat/*` - 功能分支
- `fix/*` - 修复分支
- `release/*` - 发布分支

## PR 流程

1. Fork 仓库并创建分支
2. 编写代码并添加必要的测试
3. 运行 `npm run typecheck` 确保类型正确
4. 提交 PR，填写模板
5. 等待 Review，通过后合并

## 添加新配置示例

1. 在 `public/config-examples/` 创建 `场景名.json`
2. 参考现有示例，字段名需与实际导出表头一致
3. 在 README 的"适用场景"表格中添加一行
4. 提交 PR

## 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式 + Hooks
- 样式使用 Tailwind CSS 工具类
- 避免不必要的注释，代码自解释
- 错误处理要用户友好

## 国际化

目前仅支持中文，欢迎贡献 i18n 方案。

## 许可证

提交的代码将采用 MIT 许可证。

## Developer Certificate of Origin (DCO)

本项目采用 [Developer Certificate of Origin 1.1](https://developercertificate.org/) 替代 CLA。**每个 commit 必须包含 `Signed-off-by` 行**，表示你有权提交该贡献并同意以 MIT 许可。

### 如何签名

```bash
# 单次提交带签名
git commit -s -m 'feat: add awesome feature'

# 已有提交追加签名（重写历史，push 前）
git commit --amend -s --no-edit
# 或批量
git rebase --signoff HEAD~3

# 配置自动签名（可选）
git config --global alias.cs 'commit -s'
git config --global alias.ams 'commit --amend -s'
```

提交信息末尾应包含：

```
Signed-off-by: Your Name <you@example.com>
```

`git commit -s` 会自动追加该行。PR 会由 `dco.yml` 工作流检查所有 commits 的 `has-signoff`。

### DCO 全文

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

### 常见问题

- **DCO 检查失败？** 确保每个 commit 都有 `Signed-off-by`，`git log --show-signature` 自检，或 `git rebase --signoff` 批量修复后 `git push --force-with-lease`。
- **邮箱不一致？** `Signed-off-by` 的邮箱需与 `git config user.email` 一致。
- **机器人提交？** `dependabot[bot]` 等机器账号由 maintainers 豁免（见 `dco.yml`）。