# Pricing

> **Honest statement as of v1.0.0 (2026-08-24): everything in this repository is free. There is no paid tier today. The table below is the *planned* model so you can evaluate future risk. We will not paywall existing Community features.**

## Model — Open Core + Hosted Value-Add

Approved in `PLAN_COMMERCIALIZATION.md §2` and compatible with MIT + `TRADEMARK.md`.

| Tier | License | What you get | Price Today | Planned Price |
| ---- | ------- | ------------ | ----------- | ------------- |
| **Community** | MIT | Everything in this repo — local-first review tool, config-driven UI, CSV/xlsx ingest, filtering, export, Docker, all `public/config-examples/` | **Free forever** | **Free forever** |
| **Cloud (SaaS)** | Closed-source SaaS (hosts Community core) | Multi-tenant, comments/collaboration, audit trail, SSO (OIDC/SAML), large-file handling, hosted SLA, `demo.*` | **Not yet offered** | **TBD** — per-seat / per-event (Phase 1.5+) |
| **Enterprise** | Commercial license | Private deployment, IAM integration, PWA offline, `exceljs` hardening as default, annual support, custom FieldConfig | **Not yet offered** | **TBD** — annual support (Phase 2) |

### What stays free

- All features that exist today remain MIT and free. Future **additive** paid features are hosting or enterprise hardening only.
- Self-hosting is always free: `Vercel` / `Netlify` / `Cloudflare Pages` / `GitHub Pages` / `Docker` (see `README.md#部署`).
- Config marketplace and community config examples remain free.

### What will be paid (when launched)

- **Cloud:** We run it for you — uptime, scaling, collaboration backend, SSO, observability.
- **Enterprise:** We harden and support it inside your VPC — IAM, PII policies, air-gapped PWA, `exceljs` default, SLAs.

No data lock-in: `exportToCSV` and `ViewConfig` JSON remain portable.

## Current Status (Phase 0–1)

- **Phase 0 (now):** Compliance sprint — `SECURITY.md` / `CODE_OF_CONDUCT.md` / `TRADEMARK.md` / DCO / `rebrand.sh` / `npm audit` gate.
- **Phase 1 (next 6–8 weeks):** Commercial MVP — wizard, i18n, `FieldConfig` extension, `demo.*`, `FUNDING.yml` sponsorship (optional).
- **Phase 1.5+:** Cloud pricing will be published here **before** any billing is enabled. Until then, ignore any third-party pricing claims.

## FAQ

**Q: Will you retroactively charge for today's features?**  
No. `PRICING.md` and `GOVERNANCE.md` guarantee Community stays MIT. Any change to this promise would be a breaking governance change requiring 2 maintainer approvals and a 7-day review.

**Q: Do I need to rebrand if I self-host?**  
Only if you distribute commercially under a confusingly similar brand (see `TRADEMARK.md`). Internal self-hosting does not require rebranding, but we recommend running `scripts/rebrand.sh` for your fork.

**Q: How is PWA priced?**  
PWA offline is **planned** and currently honest-labeled as *"计划中"* in `README.md`. If it ships, the basic PWA will be Community; enterprise PWA policies (e.g., air-gapped, MDM) may be Enterprise.

**Q: Where do I ask pricing questions?**  
Open an Issue labeled `pricing`, or email `security@applicant-review.dev` (subject `[Pricing]`) — we track demand for Cloud/Enterprise prioritization.

## Contact

- Issues: https://github.com/01luyicheng/applicant-review/issues
- Email (placeholder): `security@applicant-review.dev`
- Future Cloud/Enterprise contact will be published here when available.

---

*Last updated: 2026-08-24. Next review on any pricing change.*
