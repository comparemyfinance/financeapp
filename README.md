# financeapp

Google Apps Script CRM and vehicle-finance workflow application used to manage leads/deals, run quote comparisons, and support lender/integration flows.

## What this repo is

This repo contains:

- Apps Script backend endpoints and business logic (`Code.gs`, `Auth.js`, `Lenderapi.gs`)
- HTML-based CRM UI templates (`Index.html`, `tab*.html`)
- CI quality gates and deployment automation to Google Apps Script
- Architecture and change-safety docs under `docs/`

## 90-second setup

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm ci
npm run hooks:install
```

### Validate locally

```bash
npm run sanity
npm run lint
npm test
# Behavioral contract + smoke suite only
npm run test:behavioral
```

## How to run

This app runs as a deployed Google Apps Script Web App (not a local Node server).

Local development workflow is:

1. Edit `.gs`, `.js`, `.html`, and docs files.
2. Run lint/tests locally.
3. Open/update Apps Script deployment using CI deploy workflow (push to `main`).

## Top-level structure

- `Code.gs` – main backend router + sheet/Drive/Jigsaw operations
- `Auth.js` – auth/session helpers
- `Lenderapi.gs` – lender quote data/calculation helpers
- `Index.html` – main UI shell template
- `tab*.html` – tab-specific UI partials
- `appsscript.json` – Apps Script manifest
- `scripts/` – repo validation scripts
- `docs/` – architecture/domain/change guidance
- `.github/workflows/` – CI and deployment workflows

## Main workflows

- **Quality gate (local/CI):**
  - `npm run lint` (format check + syntax validation)
  - `npm test` (sanity + syntax validation + behavioral contracts/smoke)
- **PR CI:** `.github/workflows/ci.yml`
- **Post-merge checks:** `.github/workflows/post-merge-quality.yml`
- **Deploy to Apps Script:** `.github/workflows/deploy.yml` on push to `main`

## Where to learn more

- Agent and contributor expectations: `AGENTS.md`
- Architecture map: `docs/architecture.md`
- Domain model + terms: `docs/domain-model.md`
- Safe change procedures: `docs/change-playbook.md`
- API action contracts: `docs/API_ACTIONS.md`
- Canonical file map: `docs/CANONICAL_FILES.md`
- Error envelope policy: `docs/ERROR_POLICY.md`
- Environment/runtime assumptions: `docs/ENVIRONMENT.md`
- Setup checklist: `docs/SETUP_CHECKLIST.md`
- Test strategy and refactor gates: `docs/TEST_STRATEGY.md`
- Ambiguity/dedup decisions: `docs/DEDUP_MAP.md`
- Canonical auth/session flow: `docs/AUTH_FLOW.md`
- Historical audit context: `docs/audit.md`, `docs/audit-report.md`

## Deployment secrets (GitHub)

Required for deploy workflow:

- `CLASPRC_JSON_B64`
- `CLASP_SCRIPT_ID`
- `GAS_DEPLOYMENT_ID`

## Contributor notes

- Keep Apps Script entry template as `Index.html` unless backend template loading changes too.
- Prefer updating package scripts for checks rather than adding workflow-only one-off commands.
- Do not commit credentials or new hardcoded secrets.
