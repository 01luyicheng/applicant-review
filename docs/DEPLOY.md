# DEPLOY — 部署指南（四路 + Docker）

> 纯静态站点（`vite build → dist`），零后端即可跑；`public/config.json` 与 `src/config.ts` 同源校验见 §5。
> 环境变量仅 `VITE_ENABLE_LOG`（默认禁用上报），其余零配置。

## 0. 构建产物

```bash
npm ci
npm run build   # tsc && vite build && rm -f dist/example.csv
# 产物：dist/（index.html + assets/），已剔除 public/example.csv，publicDir 仍为 public 以便 dev 调试
npm run preview # 本地预览 dist
```

> `dist/example.csv` 已在 `package.json:build` 后自动删除，避免示例数据随发版外泄；`public/example.csv` 仅 `npm run dev` 可见。

---

## 1. Vercel（推荐）

**一键**：`README` 顶部 `Deploy with Vercel` 按钮（`https://vercel.com/new/clone?repository-url=https://github.com/YOUR_ORG/applicant-review`，需先 `scripts/rebrand.sh YOUR_ORG`）。

**手动**：

```bash
# 1. 导入仓库到 Vercel，Framework Preset 选 Vite
# 2. Build Command: npm run build
#    Output Directory: dist
#    Install Command: npm ci
# 3. 环境变量（可选）：
#    VITE_ENABLE_LOG=1  # 仅需远程日志时开启，默认 0（见 §6）
# 4. 部署后访问 https://<project>.vercel.app，拖拽 public/example.csv 自测
```

**SPA 回退**：Vercel 自动处理 `rewrites`，无需额外配置；如需自定义 `vercel.json`：

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## 2. Netlify

**一键**：`README` 顶部 `Deploy to Netlify` 按钮。

**手动 / CLI**：

```bash
# 方式 A：Git 集成
#  Netlify → Add new site → Import an existing project → 选仓库
#  Build command: npm run build
#  Publish directory: dist

# 方式 B：CLI（ci.yml deploy-preview 同款）
npm i -g netlify-cli
netlify deploy --dir=dist --message="preview"           # 预览
netlify deploy --dir=dist --prod --message="prod"       # 生产
# 需配置环境变量：
#  NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID  （见 .github/workflows/ci.yml: deploy-preview）
```

**SPA 回退**：项目根 `public/_redirects`（如不存在则新建）：

```
/*    /index.html   200
```

或 `netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 3. Cloudflare Pages

```bash
# 1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
# 2. 选仓库，Build settings：
#    Framework preset: Vite
#    Build command: npm run build
#    Build output directory: dist
#    Node version: 20（或 .nvmrc: 20）
# 3. 环境变量（可选）：VITE_ENABLE_LOG=1
# 4. Save and Deploy → 访问 https://<project>.pages.dev
```

**SPA 回退**：Cloudflare Pages 自动将 `404` 回退到 `index.html` 的 `SPA` 模式；如需显式 `_redirects` 同 Netlify 写法亦兼容。

**缓存**：静态资源 `assets/*.js` 已哈希，CDN 长期缓存；`index.html` 不缓存以保证配置热更新。

---

## 4. GitHub Pages

**分支部署**（`gh-pages`）：

```bash
npm run build
npx gh-pages -d dist   # 需 npm i -D gh-pages
# 或手动：
git checkout --orphan gh-pages
cp -r dist/* .
git add . && git commit -m "chore: gh-pages" && git push origin gh-pages --force
```

**Actions 部署**（推荐，`peaceiris/actions-gh-pages@v4`）：

```yaml
# .github/workflows/pages.yml（示例，需自行创建）
name: Pages
on:
  push: { branches: [main] }
permissions: { contents: write, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.1.7
      - uses: actions/setup-node@v4.0.3
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with: { github_token: ${{ secrets.GITHUB_TOKEN }}, publish_dir: ./dist }
```

**SPA 回退**：GitHub Pages 无服务端重写，需 `public/404.html` 复制 `index.html`（`cp dist/index.html dist/404.html`）或在 `vite.config.ts` 配置 `base: '/<repo>/'` 后访问 `https://<org>.github.io/<repo>/`。

> `base` 说明：若仓库名为 `applicant-review` 且 Pages 路径为 `https://<org>.github.io/applicant-review/`，则 `vite.config.ts` 需 `base: '/applicant-review/'`，否则资源 404；自定义域名可保持 `base: '/'`。

---

## 5. Docker（自托管 / 私有化）

### 5.1 本地构建与运行

```bash
docker build -t applicant-review -f docker/Dockerfile .
docker run -d -p 8080:80 --name applicant-review applicant-review
# 访问 http://localhost:8080
# 镜像内：node:20-alpine 构建 → nginx:alpine 运行，SPA 回退见 docker/nginx.conf: try_files $uri $uri/ /index.html

# docker-compose
docker-compose up -d
# 等价：docker compose up -d（v2）
```

### 5.2 GHCR 拉取（发布后）

```bash
# release.yml 真推后可用（见 §7 与 .github/workflows/release.yml 注释）
docker pull ghcr.io/YOUR_ORG/applicant-review:latest
docker pull ghcr.io/YOUR_ORG/applicant-review:v1.0.0
docker run -d -p 8080:80 ghcr.io/YOUR_ORG/applicant-review:v1.0.0
```

> 当前 `release.yml` 为 **假推送**（`push: false, load: true` 仅本地验证），`ci.yml:docker` 同理；真推需按 `release.yml:27-30` 注释取消并配置 `GITHUB_TOKEN`（见 §7）。

### 5.3 私有化注意

- `docker/nginx.conf` 已含 `X-Frame-Options: SAMEORIGIN / X-Content-Type-Options: nosniff / gzip`，可按需加 `Content-Security-Policy`
- 如需内网域名，将 `VITE_ENABLE_LOG` 保持 `0`（默认），避免外发

---

## 6. 环境变量

| 变量 | 默认 | 作用 | 何时开启 |
|------|------|------|----------|
| `VITE_ENABLE_LOG` | `0`（禁用） | 允许 `src/utils/logger.ts:postLog` `POST /log` 上报；`window.SENTRY` 存在则优先走 Sentry | 需远程日志/自建 `/log` 接收端时设为 `1` |

```bash
# 本地开启（调试上报）
VITE_ENABLE_LOG=1 npm run dev
# 生产（Vercel/Netlify/CF Pages 控制台 → Environment Variables）
VITE_ENABLE_LOG=1
# Docker 构建时注入
docker build --build-arg VITE_ENABLE_LOG=1 -t applicant-review .
# 或运行时通过 nginx 子路径代理 /log 到后端（需自行在 nginx.conf 加 location /log { proxy_pass ... }）
```

> **隐私**：`logger.ts: redactContext` 对 `手机|邮箱|微信|phone|mail|tel|mobile|wechat|id` 做掩码；`VITE_ENABLE_LOG≠1` 时 `fetch('/log')` 完全不执行（与 `README 🔒 隐私与数据说明` 一致）。

---

## 7. 配置同源说明（`?config=`）

> 详见 `src/config.ts:14,70-97,199-212`。

- **加载优先级**：`?config=https://...`（远程） > `localStorage: applicant-review-config`（本地上传/构建器） > `/config.json`（`public/config.json`） > `DEFAULT_CONFIG`（`src/types.ts: generic 最小模板`）
- **同源限制（默认）**：`ALLOWED_ORIGINS = [window.location.origin]`，仅允许同源 `?config=`。跨域返回 `null` 并 `reportWarn('远程配置仅允许同源')`。
- **二次校验**：`fetchRemoteConfig` 入口再次校验 `new URL(url, location.origin).origin`，非同源抛 `Error('远程配置仅允许同源')`。
- **放宽白名单**（私有化/多域）：
  ```ts
  // src/config.ts:14
  export const ALLOWED_ORIGINS: string[] = [
    window.location.origin,
    'https://config.your-org.com', // 显式加入可信配置域
  ];
  ```
  或构建时通过 `VITE_ALLOWED_ORIGINS`（需自行在 `config.ts` 中读取 `import.meta.env.VITE_ALLOWED_ORIGINS` 并 split）。
- **超时与缓存**：`fetchRemoteConfig` 5s `AbortController` 超时，失败回退 `sessionStorage: config-cache-<url.slice(0,200)>`；`getCacheKey` 限长 200 防超长 URL。
- **CORS**：远程配置域需返回 `Access-Control-Allow-Origin: <页面 origin>`，否则 `mode:'cors'` 触发 `CORS或网络错误` 抛错并回退缓存。

---

## 8. 常见排错

| 现象 | 排查 |
|------|------|
| `npm ci` 失败 | Node `>=20` / npm `>=9`（`package.json:engines` + `.nvmrc:20`），删 `node_modules` 重试 |
| `npm run build` 后 `dist` 为空 | 检查 `vite.config.ts: publicDir` 是否 `public`，`tsc` 是否报错（`npm run typecheck`） |
| 页面空白 / 资源 404 | GitHub Pages 需 `base: '/<repo>/'`；Vercel/Netlify 检查 `Output Directory: dist` |
| `?config=` 不生效 | 控制台看 `reportWarn`，确认同源；跨域需改 `ALLOWED_ORIGINS` 并配 CORS |
| `POST /log 404` | 默认禁用属正常；需上报时设 `VITE_ENABLE_LOG=1` 并在 nginx/后端加 `/log` 代理 |
| Docker 无法拉取 `ghcr.io` | 确认 `release.yml` 已真推（`push:true`），`docker pull ghcr.io/YOUR_ORG/applicant-review:<tag>` 大小写与仓库一致 |

---

## 9. 一键验证（本地快速落地检查）

> 用于交付前快速判定“是否真可部署”—— 无需任何远程依赖。

```bash
# 方式 A：完整验证（含 Docker，注意需本机 docker daemon 运行）
npm ci && npm run build && docker build -f docker/Dockerfile -t applicant-review:test . && docker run -p 8080:80 applicant-review:test
# 访问 http://localhost:8080 ，验证 SPA 回退：刷新 /任意路由 应仍返回 index.html（见 docker/nginx.conf: try_files）

# 方式 B：无 Docker 环境（纯静态托管验证，Vercel/Netlify/CF Pages 等价）
npm ci && npm run build && npx serve dist
# 或 npm run preview
# 预期 dist 清单：index.html + assets/ + config.json + config-examples/generic.json，且 dist/example.csv 已剔除

# 清理
docker rm -f applicant-review 2>/dev/null; docker rmi applicant-review:test 2>/dev/null
```

> `docker build` 依赖 `docker/docker-compose.yml` 与根 `docker-compose.yml`（`context: . / dockerfile: docker/Dockerfile`）均已对齐；`npx serve` 零依赖验证 SPA 静态产物。

---

*校验：`npm run typecheck && npm run build` 通过；`dist` 含 `index.html / assets`，无 `example.csv`。2026-08-24 已执行 `npm run build` 并记录 `dist` 清单见 §0 注释。*
