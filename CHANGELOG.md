# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and [Conventional Commits](https://www.conventionalcommits.org/).

## [1.0.0] - 2026-08-24

First public release — **Applicant Review** as a generic, local-first activity application review tool.

### Added

- **Core:** Drag-and-drop `xlsx`/`csv` ingestion, config-driven table + detail modal, stats bar, multi-dimensional filtering, batch CSV export, keyboard shortcuts.
- **Config:** `ViewConfig` (`title`/`idField`/`nameField`/`listFields`/`detailGroups`/`statusField`/`statusValues`), priority cascade: `?config=` URL → uploaded file → `public/config.json` → `DEFAULT_CONFIG`. Validation + `__proto__` sanitization.
- **Examples:** `public/config-examples/` — `hackathon.json`, `campus-recruit.json`, `scholarship.json`, `vendor.json` (generic template planned per `PLAN_COMMERCIALIZATION.md`).
- **Privacy:** Browser-only processing (`sessionStorage`), PII masking defaults, synthetic `public/example.csv`, `dist` strips example on build.
- **Security:** CSV injection guard (`sanitizeCsvCell`), same-origin guard for remote config, 5s fetch timeout, `npm audit` guidance, honest `xlsx@0.18.5` disclosure in `README.md` + `package.json#_comment_xlsx`.
- **Docs:** `README.md`, `CONTRIBUTING.md`, `LICENSE` (MIT), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `TRADEMARK.md`, `GOVERNANCE.md`, `PRICING.md`, `NOTICE`, `CHANGELOG.md`, `PLAN_COMMERCIALIZATION.md`.
- **CI/CD:** `ci.yml` (typecheck/lint/test/build/docker/preview), `release.yml` (tag `v*` → `dist.zip` + GitHub Release), Docker + Nginx, Vercel/Netlify deploy buttons.
- **Tooling:** `scripts/rebrand.sh` for one-click `YOUR_ORG` → `YOUR_ORG` replacement; DCO via `Signed-off-by` + `dco.yml` workflow.
- **Tests:** `vitest` suite — 14 files, 128 passing + 3 todo (131 total), coverage **Lines 76.88% / Statements 72.76% / Branches 63.11% / Functions 70.71%** (`v8` provider, thresholds `70/60/70/70` 阻塞已达成，见 `vite.config.ts:thresholds`).
- **App & PWA:** `src/App.tsx` 208 行（主应用含 header 画廊下拉 + i18n 切换）；PWA 已落地 — `vite-plugin-pwa@^1.3.0` + `VitePWA({ registerType:'autoUpdate' })` 已集成于 `vite.config.ts:plugins`，`manifest: { name:'Applicant Review' }` 可离线安装（此前为计划中）。

### Security

- Documented `xlsx` Prototype Pollution / ReDoS risk and mitigations; `logger.ts` POST `/log` disabled by default (`VITE_ENABLE_LOG=1` to enable).

### Changed

- Brand-neutral placeholders (`YOUR_ORG/applicant-review`) with TODOs for forking.

### Fixed

- Duplicate header detection, CSV quoting, remote config CORS/timeout surfacing.

---

## Template for Future Entries

```markdown
## [Unreleased]

### Added
- feat(scope): description (#PR)

### Changed
- ...

### Deprecated
- ...

### Removed
- ...

### Fixed
- fix(scope): description (#PR)

### Security
- ...

[Unreleased]: https://github.com/YOUR_ORG/applicant-review/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_ORG/applicant-review/releases/tag/v1.0.0
```

### How to write entries

- Use **Conventional Commits** types: `feat`, `fix`, `docs`, `refactor`, `config`, `chore`, `test`, `perf`, `security`.
- Link PRs/issues: `(#123)` and add `BREAKING CHANGE:` footer when applicable.
- `Unreleased` accumulates changes since the last tag; on release, rename it to the new version and date, and reset `Unreleased`.

### Release process

1. Update this file: move `Unreleased` → `x.y.z - YYYY-MM-DD`.
2. Bump `package.json#version` (SemVer).
3. Tag `v x.y.z` and push: `git tag v1.1.0 && git push origin v1.1.0` — triggers `.github/workflows/release.yml`.
4. Verify GitHub Release attaches `dist.zip` and links back here.

[Unreleased]: https://github.com/YOUR_ORG/applicant-review/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_ORG/applicant-review/releases/tag/v1.0.0
