# Governance

## Principles

- **MIT + Open Core** — Community edition stays MIT; Cloud/Enterprise are additive and do not close existing features (see `PRICING.md`, `TRADEMARK.md`).
- **Local-first, privacy-preserving, config-driven** — per `PLAN_COMMERCIALIZATION.md`.
- **Small steps, tests first** — architectural changes land behind tests and feature flags.

## Roles

| Role | Who | Responsibilities | How to become |
| ---- | --- | ---------------- | ------------- |
| **User / Contributor** | Anyone | Opens issues/PRs, follows `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md`, signs off with `Signed-off-by` (DCO) | Just contribute |
| **Reviewer** | Active contributors | Reviews PRs, triages issues, improves docs/tests | Invited after sustained quality contributions |
| **Maintainer** | Owners of `YOUR_ORG/applicant-review` | Merge rights on `main`, cut releases, enforce `SECURITY.md` / `CODE_OF_CONDUCT.md`, own Roadmap | Nominated by existing maintainers, lazy consensus |
| **PM (rotating)** | One maintainer | Drives Milestones, updates `PLAN_REVIEW_LOG.md`, breaks ties | Rotated per Phase |

Current maintainers are the GitHub org owners. As the community grows, this file will list them explicitly.

## Decision Making

1. **Lazy consensus (default):** A proposal (Issue/PR/Discussion) is considered accepted if no maintainer objects within **72 hours** (business days). One maintainer's `+1` is enough to merge non-breaking PRs that pass CI.
2. **Breaking / controversial changes:** Require **2 maintainer approvals** and a **7-day** comment window. Examples: `ViewConfig` schema changes, `xlsx` → `exceljs` default switch, license/policy edits, CI `required` checks.
3. **Deadlock:** PM breaks the tie after soliciting input from all maintainers. If still blocked, a **majority vote** of maintainers decides.
4. **Veto:** Any maintainer may veto on security/legal grounds; veto must cite `SECURITY.md`, `TRADEMARK.md`, or applicable law and be resolved before proceeding.
5. **Reversibility:** Decisions can be revisited via a new proposal with new evidence.

All significant decisions are recorded as comments on the relevant Issue/PR and summarized in `PLAN_REVIEW_LOG.md` (for Phase 0/1) or GitHub Discussions thereafter.

## Roadmap Mechanism

- **Source of truth:** GitHub **Milestones** + **Projects** board, aligned with `PLAN_COMMERCIALIZATION.md §4`:
  - `Phase 0 — Compliance Sprint` (OSSF ≥7, audit `high=0`, coverage 50%)
  - `Phase 1 — Commercial MVP` (wizard, i18n, FieldConfig, demo, SUS≥70)
  - `Phase 1.5 — Performance` (SLA: P95 <2s / INP <200ms)
  - `Phase 2 — Scale` (collaboration backend, config marketplace)
- **Intake:** Anyone may propose via Issue labeled `roadmap`. Maintainers triage weekly.
- **Prioritization:** Impact × effort, with P0 = "cannot claim *free for commercial use* without it" (see Plan §1).
- **Execution:** `GitHub Milestone` drives assignment. Cross-track dependencies use `PLAN_REVIEW_LOG.md` daily updates (Phase 0) then weekly Discussion posts.
- **Release cadence:** `1.x.y` patch on `main` for fixes; minor/major via `release/*` branches and tags `v*` (see `.github/workflows/release.yml`). `CHANGELOG.md` is updated with every release.

## Security & Conduct Governance

- **Security:** See `SECURITY.md` — private reporting to `security@applicant-review.dev`, 90-day disclosure.
- **Code of Conduct:** See `CODE_OF_CONDUCT.md` — reports to `security@applicant-review.dev` (subject `[CoC]`). Maintainers handle enforcement; conflicts of interest require recusal.

## Changing This Document

PR against `GOVERNANCE.md` with `governance` label, 7-day review, 2 maintainer approvals. Changes take effect on merge.

## Contact

- Issues / Discussions: https://github.com/YOUR_ORG/applicant-review
- Security / CoC: `security@applicant-review.dev`
- Governance questions: open an Issue labeled `governance`
