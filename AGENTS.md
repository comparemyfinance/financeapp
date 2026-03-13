# AGENTS.md

## Purpose

This repository contains a Google Apps Script CRM + vehicle refinance workflow app used by internal teams to manage leads/deals, produce finance comparisons, and integrate with lender-related flows.

What matters most in this repo:

- Keep production workflows stable (deals, auth/session, lender calculations, Jigsaw, client files).
- Preserve request/response compatibility for existing front-end callers.
- Make low-risk, incremental changes that are easy to review and roll back.

## Architecture map

- **Server runtime (Apps Script):**
  - `Code.gs` – API routing, sheet CRUD, locking, Drive folder/file helpers, Jigsaw integration/webhooks.
  - `Auth.js` – token-based auth helpers.
  - `Lenderapi.gs` – lender list/quote calculations (placeholder + helper math).
- **UI runtime (Apps Script HTML templates):**
  - `Index.html` – main template shell and shared scripts.
  - `tab*.html` – feature tab templates/partials.
- **Operational/config:**
  - `appsscript.json` – Apps Script runtime and webapp config.
  - `.github/workflows/*.yml` – CI, post-merge checks, deploy.
- **Tooling/docs:**
  - `scripts/*.mjs` – syntax and merge-marker checks.
  - `docs/*.md` – architecture, audits, operational guides.

## Golden rules

- Do **not** change API contracts (`action`, payload shape, response envelope) without updating docs and compatibility notes.
- Prefer isolated refactors over broad rewrites.
- Preserve behavior unless the task explicitly requests behavior change.
- Keep Apps Script entry points stable (`doGet`, `doPost`, `handleWebClientRequest`).
- Do not introduce new secrets into source files.

## Commands

- install: `npm ci`
- dev (quality baseline): `npm run sanity`
- lint: `npm run lint`
- typecheck: `N/A` (no TS/typed build configured)
- test: `npm test`
- build: `N/A` (Apps Script runtime, no compile step)
- deploy (CI): push to `main` triggers `.github/workflows/deploy.yml`

## Definition of done

A task is complete only if:

- lint passes (`npm run lint`)
- tests/checks pass (`npm test`)
- docs are updated if public behavior, contracts, or workflows changed
- no unrelated files are changed
- no secrets/credentials were added to source

## File ownership / boundaries

- `Code.gs`: server routing/integration logic only. Avoid adding large UI snippets here.
- `Auth.js`: auth/session logic only.
- `Lenderapi.gs`: lender quote math and lender-data helpers only.
- `Index.html`: shared shell + cross-tab wiring.
- `tab*.html`: feature-specific UI; keep tab behavior isolated where possible.
- `docs/`: canonical engineering docs; add/update docs here instead of comments-only guidance.
- `scripts/`: repo checks and automation helpers.

## Safe change patterns

- Add or modify one action at a time in `routeAction_`, with explicit validation.
- Reuse existing utility helpers before introducing new variants.
- Prefer additive changes + compatibility fallbacks, then cleanup in follow-up PRs.
- Keep naming consistent with existing suffix conventions (`*_`, `safe*`, `get*`).
- For UI rendering, prefer escaped text and avoid expanding raw HTML interpolation.

## Dangerous areas

- `Code.gs` router and write paths (`save`, `delete`, `batchUpdate`) because they affect all deal persistence.
- Auth/session flows (`Auth.js`, token usage in templates) because stale token behavior can lock users out.
- Jigsaw integration/webhook code in `Code.gs` because it handles external calls, signatures, and deal updates.
- Large inline scripts in `Index.html` / `tabSalesPipeline.html` due to high coupling and duplication risk.

## Canonical sources

- Primary project overview/runbook: `README.md`
- Architecture source of truth: `docs/architecture.md`
- Domain definitions and entities: `docs/domain-model.md`
- Safe modification workflows: `docs/change-playbook.md`
- Historical audit context: `docs/audit.md`, `docs/audit-report.md`, `docs/runtime-review-pr-plan.md`
