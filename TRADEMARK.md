# Trademark Policy

## Summary

- **Code license ≠ trademark license.** This repository is licensed under the **MIT License** (see `LICENSE`), which covers copyright and permission to use, copy, modify, and distribute the *code*.
- **Names, logos, and brand assets are NOT covered by the MIT license.** You may not use the project's trademarks to imply endorsement or official status without permission.
- **If you fork or commercially redistribute, you must rebrand.** See below.

## What Is Protected

The following are trademarks / trade dress of the project maintainers (or their respective owners) and are **not** licensed under MIT:

- Project names such as `Applicant Review` and any prior working names (e.g., `01luyicheng` where used as a brand).
- Logos, icons, wordmarks, color schemes, and marketing copy that identify the project.
- Domain placeholders like `applicant-review.dev` / `demo.applicant-review.dev` where operated by the maintainers.

Third-party marks (e.g., `Feishu`, `Tencent Docs`, `Notion`, `Vercel`, `Netlify`) remain property of their respective owners.

## What You Can Do (Without Permission)

- Fork the repository and use the **code** under MIT terms.
- Accurately describe origin: e.g., _"Based on Applicant Review (https://github.com/01luyicheng/applicant-review), MIT licensed"_.
- Use the name **nominatively** to state compatibility or origin (truthful, non-misleading, no logo).

## What Requires Permission / Rebranding

You **must rebrand** (rename, replace logo, change domains) before any of the following:

- Publishing a fork as a competing product/service under the same name or a confusingly similar name.
- Commercial distribution (SaaS, app store, Docker image, marketplace listing) that presents itself as the official project.
- Marketing that implies endorsement, sponsorship, or affiliation.

**How to rebrand (one command):**

```bash
./scripts/rebrand.sh 01luyicheng your-product-name
# or interactively:
./scripts/rebrand.sh
```

This replaces `01luyicheng` / `01luyicheng` placeholders in `package.json` (`homepage` / `repository` / `bugs`), `README.md`, `CONTRIBUTING.md`, `.github/`, and docs. Review the `git diff` before committing.

Manual checklist if you don't use the script:

- [ ] `package.json`: `name`, `author`, `homepage`, `repository.url`, `bugs.url`
- [ ] `README.md`: clone URLs, deploy buttons, demo links
- [ ] `CONTRIBUTING.md`: clone URLs
- [ ] `.github/workflows/*`, `.github/ISSUE_TEMPLATE/*`, `PULL_REQUEST_TEMPLATE.md`
- [ ] `LICENSE` copyright holder if you substantially fork
- [ ] Any hosted domains / Docker tags / screenshots containing the old brand

## MIT Compatibility

The MIT license does **not** grant trademark rights. This policy is compatible with Open Source Initiative guidance: trademark restrictions that merely prevent confusion do not make the software non-free, provided the code itself remains freely usable under MIT. This is the **Open Core + hosted value-add** model described in `PRICING.md` and `PLAN_COMMERCIALIZATION.md §2`.

## Questions

- General: open a GitHub Issue with label `trademark`.
- Private: `security@applicant-review.dev` (subject `[Trademark]`).

We will respond on a best-effort basis. For legal advice, consult your own counsel.
