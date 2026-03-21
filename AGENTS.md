# AGENTS.md

## Purpose

This repository contains a Google Apps Script CRM + vehicle refinance workflow app used by internal teams to manage leads/deals, produce finance comparisons, and integrate with lender-related flows.

What matters most in this repo:

- Keep production workflows stable (deals, auth/session, lender calculations, Jigsaw, client files).
- Preserve request/response compatibility for existing front-end callers.
- Make low-risk, incremental changes that are easy to review and roll back.

## Architecture Map

- **Server runtime (Apps Script):**
  - `Code.gs` - API transport, sheet CRUD, locking, Drive helpers, and webhook/integration support.
  - `server/router/actions.gs` - canonical action routing and auth-gated dispatch.
  - `server/shared/config.gs` - Script Property and runtime config resolution.
  - `server/shared/response.gs` - canonical response/error envelope helpers.
  - `Auth.js` - token-based auth helpers.
  - `Lenderapi.gs` - lender list/quote calculations plus lender/provider outbound integration helpers.
- **UI runtime (Apps Script HTML templates):**
  - `Index.html` - main template shell, shared API wrapper, session bootstrap, and current Application tab runtime.
  - `tab*.html` - feature tab templates/partials.
- **Operational/config:**
  - `appsscript.json` - Apps Script runtime and web app config.
  - `.github/workflows/*.yml` - CI, post-merge checks, deploy.
- **Tooling/docs:**
  - `scripts/*.mjs` - syntax, runtime, and merge-marker checks.
  - `docs/*.md` - architecture, audits, runtime truth, and operational guides.

## Golden Rules

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

## Definition Of Done

A task is complete only if:

- lint passes (`npm run lint`)
- tests/checks pass (`npm test`)
- docs are updated if public behavior, contracts, or workflows changed
- no unrelated files are changed
- no secrets/credentials were added to source

## File Ownership / Boundaries

- `Code.gs`: entry transport, sheet helpers, and legacy runtime helpers only. Avoid adding large UI snippets here.
- `server/router/actions.gs`: add/modify API action dispatch here first.
- `server/shared/config.gs`: config lookup and required-property behavior live here.
- `server/shared/response.gs`: canonical success/error envelope helpers live here.
- `Auth.js`: auth/session logic only.
- `Lenderapi.gs`: lender quote math, provider mapping, and lender outbound integration helpers.
- `Index.html`: shared shell, session/bootstrap, shared API transport, and Application tab wiring.
- `tab*.html`: feature-specific UI; keep tab behavior isolated where possible.
- `docs/`: canonical engineering docs; add/update docs here instead of comments-only guidance.
- `scripts/`: repo checks and automation helpers.

## Safe Change Patterns

- Add or modify one action at a time in `routeAction_`, with explicit validation.
- Reuse existing utility helpers before introducing new variants.
- Prefer additive changes + compatibility fallbacks, then cleanup in follow-up PRs.
- Keep naming consistent with existing suffix conventions (`*_`, `safe*`, `get*`).
- For UI rendering, prefer escaped text and avoid expanding raw HTML interpolation.

## Dangerous Areas

- `Code.gs` write paths (`save`, `delete`, `batchUpdate`) because they affect all deal persistence.
- Auth/session flows (`Auth.js`, token usage in templates) because stale token behavior can lock users out.
- Jigsaw webhook entry/writeback code in `Code.gs` and lender outbound transport in `Lenderapi.gs` because they handle external calls, signatures, and deal updates.
- Large inline scripts in `Index.html` / `tabSalesPipeline.html` due to high coupling and duplication risk.
- Embedded external forms in `Index.html` because iframe viability depends on deployment headers, Google sign-in behavior, and cross-origin/API constraints outside this repo.

## Runtime Truth Docs To Check First

- `docs/API_ACTIONS.md` - current action surface, auth gates, aliases, and response envelope.
- `docs/CANONICAL_FILES.md` - where edits should land.
- `docs/LIVE_FRONTEND_RUNTIME_MAP.md` - current frontend ownership for Product Source, session, and Application tab runtime.
- `docs/ENVIRONMENT.md` - Script Properties, Apps Script assumptions, and deployment behavior.
- `docs/AUTH_FLOW.md` - token/session lifecycle and idle timeout behavior.

## Embedded App Guidance

- Read `docs/application-embed-validation.md` before changing the Application tab or any iframe-based subproject integration.
- Read `docs/EMBEDDING_AND_EXTERNAL_FORMS.md` before changing cross-origin or external-form behavior.
- The current Application tab shell in `Index.html` can point at external Apps Script web apps, but the known Sales Agent and Refi Direct URLs currently fail framing due to Google sign-in redirects plus frame-blocking headers.
- Treat "open in new tab" as the safe default unless the external app has been revalidated for iframe embedding.
- Do not move secrets or privileged external API calls into client-side iframe code; keep them server-side where possible.
- If adding another embedded flow, document:
  - allowed host/origin(s)
  - authentication model
  - whether iframe embedding is supported or blocked
  - how cross-origin data exchange works (`postMessage`, query params, or no coupling)
  - fallback UX when framing fails

## Canonical Sources

- Primary project overview/runbook: `README.md`
- Architecture source of truth: `docs/architecture.md`
- Domain definitions and entities: `docs/domain-model.md`
- Safe modification workflows: `docs/change-playbook.md`
- API/action runtime truth: `docs/API_ACTIONS.md`
- Embed/external form constraints: `docs/EMBEDDING_AND_EXTERNAL_FORMS.md`, `docs/application-embed-validation.md`
- Historical audit context: `docs/audit.md`, `docs/audit-report.md`, `docs/runtime-review-pr-plan.md`
