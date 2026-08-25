# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

We support the latest `1.x` release line. Security fixes are released as patch versions (`1.x.y`) on the `main` branch.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Please report privately to:

- **Email:** `security@applicant-review.dev` (placeholder — maintainers will triage within 48h)
- **Alternative:** Open a [GitHub Security Advisory draft](https://github.com/01luyicheng/applicant-review/security/advisories/new) (Private vulnerability reporting) if enabled, or contact any maintainer listed in `GOVERNANCE.md`.

### What to include

- Affected version / commit SHA
- Reproduction steps or PoC (minimal `xlsx`/`csv` + `config.json` if relevant)
- Impact assessment (confidentiality / integrity / availability)
- Suggested mitigation if known

### Process & SLA

1. **Acknowledgement:** Within **2 business days**.
2. **Triage & reproduction:** Within **7 days** — we confirm scope and assign severity (CVSS).
3. **Fix & verification:** Target **30 days** for High/Critical, **90 days** max for all issues.
4. **Disclosure:** Coordinated disclosure after a fix is available. We follow a **90-day disclosure deadline** — if a fix cannot be shipped within 90 days of the report, we will publish an advisory with mitigation guidance and continue to track the issue publicly. Reporter may request an extension for complex fixes.
5. **Credit:** We credit reporters in the advisory and `CHANGELOG.md` unless you prefer to remain anonymous.

### Safe Harbor

We support good-faith security research on this repository. Do not exfiltrate real PII, do not degrade availability, and do not access data beyond what is necessary to demonstrate the issue.

## Known Dependency Risk — `xlsx`

| Dependency | Installed | Latest (2026-08) | Known issues |
| ---------- | --------- | ---------------- | ------------ |
| `xlsx`     | `^0.18.5` | `0.18.5`         | Prototype Pollution / ReDoS (see [GitHub Advisory search: xlsx](https://github.com/advisories?query=xlsx)) |

**Status:** `xlsx@0.20.3` had not been published to npm as of 2026-08 (latest on `https://registry.npmjs.org/xlsx` is `0.18.5`). `package.json` and `package-lock.json` intentionally stay on `^0.18.5` to keep `npm ci` reproducible (see `package.json#_comment_xlsx`).

**Mitigations in place (defense-in-depth):**

- `src/utils/fileParser.ts` — CSV formula sanitization (`sanitizeCsvCell`: prefixes `'=+-@|%'` with `'`), duplicate-header rejection, `Object.create(null)`-style raw handling.
- `src/config.ts` — `sanitizeConfigData()` strips `__proto__` / `constructor` / `prototype`; `zod`-equivalent manual validation + `superRefine`-style prototype checks; same-origin guard for `?config=` remote loading; 5s fetch timeout + CORS error surfacing.
- `src/utils/export.ts` (`exportToCSV`) — quoted CSV output with injection guard.
- Docs — `README.md#依赖与诚实性说明` explicitly calls out the risk and the `exceljs` migration path (`src/utils/fileParser.ts` is the only file to change).

**Recommended hardening for production:**

- Replace `xlsx` with [`exceljs`](https reboot) behind a Feature Flag (planned — see `PLAN_COMMERCIALIZATION.md §3.2`), or pin `xlsx` and run `npm audit --audit-level=high` in CI (enforced in `ci.yml`).
- Enable `npm audit` gate (`high=0`) and Dependabot / Renovate.
- If you handle untrusted workbooks at scale, run parsing in a Worker and enforce file-size limits.

We will upgrade to `xlsx@^0.20.3` (or switch to `exceljs` by default) as soon as a patched version is published and verified with `npm audit`.

## Security Best Practices for Deployments

- Serve as a **pure static site** (Vercel / Netlify / Cloudflare Pages / GitHub Pages / Docker + Nginx) — no server-side upload.
- Data stays in `sessionStorage` by default; closing the tab clears it. Do not commit real `*.csv`/`*.xlsx` to git — see `README.md#隐私与数据说明` for `git filter-repo` / `BFG` and `gitleaks` guidance.
- Keep `VITE_ENABLE_LOG` disabled in production (default). `src/utils/logger.ts` POST `/log` is off unless explicitly enabled.

## Hall of Fame

Thanks to all reporters who help keep Applicant Review safe. (List populated after first advisory.)
