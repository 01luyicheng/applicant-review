# Support

## Overview

Applicant Review is currently **100% free** — all features in this repository are MIT-licensed. There is no paid tier today. See `PRICING.md` for the planned Open Core model.

## Channels

| Channel | Purpose | Response |
| ------- | ------- | -------- |
| **GitHub Issues** — [YOUR_ORG/applicant-review/issues](https://github.com/YOUR_ORG/applicant-review/issues) | Bugs, feature requests, config examples | Best-effort, triaged by maintainers |
| **GitHub Discussions** (if enabled) | Q&A, usage help | Community + maintainers |
| **Security** — `security@applicant-review.dev` | Private vulnerability reports | Ack in 2 business days (see `SECURITY.md`) |
| **Email** — `security@applicant-review.dev` / `support@applicant-review.dev` (placeholder) | CoC, governance, enterprise inquiry | Best-effort |

> **Placeholder org:** `YOUR_ORG` is a neutral placeholder. Replace it via `scripts/rebrand.sh` or manually edit `package.json` / `README.md` / `.github/` URLs. See `TRADEMARK.md`.

## SLA (Best-Effort, No Guarantee)

This is a community-maintained project. We aim for:

- **Issue triage:** within **5 business days**.
- **PR review:** within **7 business days**.
- **Security reports:** acknowledgement in **2 business days**, fix target per `SECURITY.md` (30 days High/Critical, 90 days max).
- **No uptime SLA** — the app is a static frontend; deployments (Vercel/Netlify/etc.) follow their own SLAs.

Commercial SLAs will only apply if/when a Cloud/Enterprise offering launches (see `PRICING.md`).

## Scope

### In scope (free, community)

- Bug fixes, docs, config examples (`public/config-examples/`), CI, security mitigations.
- Guidance on self-hosting (Docker, Vercel, Netlify, Cloudflare Pages, GitHub Pages).
- Review of PRs that follow `CONTRIBUTING.md` and pass `npm run typecheck && npm run lint && npm test`.

### Out of scope (today)

- Private deployments / on-call support.
- Custom feature development under deadline.
- PII recovery, data migration services.

If you need these, please open an issue describing the use case — we track demand for future Cloud/Enterprise planning.

## Free vs Paid Boundary

| Tier | Status Today | Support |
| ---- | ------------ | ------- |
| **Community (MIT)** | ✅ Available | Community best-effort (this file). All current features are here. |
| **Cloud (SaaS)** | 🕒 Planned, not yet offered | Will include hosted SLA, SSO, multi-tenant, etc. |
| **Enterprise** | 🕒 Planned, not yet offered | Will include private IAM, PWA offline, `exceljs` hardening, annual support. |

**Honest statement:** _As of v1.0.0, everything is free and community-supported. We will not introduce a paywall for existing Community features; any future paid tiers will be additive (hosting / enterprise hardening) and clearly documented in `PRICING.md` before launch._

## Before You Ask

1. Search existing [Issues](https://github.com/YOUR_ORG/applicant-review/issues) and `README.md#使用指南`.
2. Reproduce on `main` with `npm run dev` and include: OS / browser / Node version / `config.json` (redacted) / sample CSV header.
3. For config questions, attach a minimal `ViewConfig` snippet and the first row of your export (desensitized).

## Version Support

See `SECURITY.md#Supported Versions`. We support the latest `1.x` line. Please upgrade before reporting.

## Commercial / Enterprise Inquiries

Not available yet. When Cloud/Enterprise launches, contact information will be published in `PRICING.md` and `GOVERNANCE.md`. Until then, please use GitHub Issues.
