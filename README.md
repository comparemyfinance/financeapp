# financeapp

Google Apps Script CRM + product sourcing application, with GitHub Actions quality gates and deploy automation.

## What’s in this repo

### Apps Script runtime files

- `Code.gs` — main backend routing, sheet operations, and server functions.
- `Auth.js` — authentication/session helpers.
- `Lenderapi.gs` — lender/integration-related logic.
- `Index.html` — primary HTML template served by Apps Script (`HtmlService.createTemplateFromFile('Index')`).
- `tab*.html` — UI partials included in the main template.
- `appsscript.json` — Apps Script manifest (runtime, webapp config, advanced services).

### Tooling / automation

- `package.json` — local quality scripts (`sanity`, `lint`, `test`, formatting).
- `scripts/validate-syntax.mjs` — validates `.gs/.js` and embedded `<script>` blocks in HTML templates.
- `.github/workflows/ci.yml` — pull request quality gate.
- `.github/workflows/post-merge-quality.yml` — post-merge quality gate on `main`.
- `.github/workflows/deploy.yml` — pushes to Google Apps Script via `clasp` and deploys.

## Prerequisites

- Node.js 20+
- npm 10+
- (For deployment) Google Apps Script credentials/secrets configured in GitHub

## Local setup

```bash
npm ci
npm run hooks:install
```

## Common commands

```bash
# Basic repo sanity (required key files exist)
npm run sanity

# Check formatting + syntax validation
npm run lint

# Sanity + syntax validation
npm test

# Auto-format supported files
npm run format
```

## CI behavior

### Pull request check (`.github/workflows/ci.yml`)

Runs on PRs to `main`:

1. `npm ci`
2. `npm run lint && npm test`

### Post-merge check (`.github/workflows/post-merge-quality.yml`)

Runs on pushes to `main`:

1. `npm ci`
2. `npm run lint && npm test`

## Deployment to Google Apps Script

Deployment is automated by `.github/workflows/deploy.yml` on push to `main`.

Required GitHub Secrets:

- `CLASPRC_JSON_B64` — base64-encoded `~/.clasprc.json`
- `CLASP_SCRIPT_ID` — target Apps Script project ID
- `GAS_DEPLOYMENT_ID` — existing deployment ID to redeploy

The workflow will:

1. Install `@google/clasp`
2. Write credential/config files
3. `clasp push -f`
4. Create a new Apps Script version
5. Redeploy the configured deployment

## Notes for contributors

- Keep Apps Script entry template as `Index.html` unless backend template-loading is updated too.
- If you add/remove required runtime files, update `npm run sanity` in `package.json`.
- Prefer updating existing CI script commands in `package.json` before adding new workflow-only checks.
