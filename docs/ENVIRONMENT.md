# Environment & Runtime Assumptions (Phase 3A)

This document captures external dependencies, configuration points, and bootstrap assumptions required to run and maintain this repo.

## Runtime platform

- Google Apps Script runtime: `V8`
- Web app configuration in `appsscript.json`
- Advanced service enabled: Drive API v3

## External dependencies

### Google Sheets

- Primary data store is a Google Spreadsheet referenced in code.
- Current hardcoded constant in `Code.gs`:
  - `SPREADSHEET_ID`
- Primary sheet names in code:
  - `Deals`
  - `VRNdata`
  - additional operational sheets are created/read by helper functions (e.g., logs, cache-related sheets)

### Google Drive

- Client file search/listing depends on Drive access.
- Current hardcoded folder root in code:
  - `ROOT_FOLDER_ID` (used to constrain folder search scope)

### Apps Script services

- `CacheService` for:
  - auth session token storage
  - row index cache
  - integration token cache
- `PropertiesService` (Script Properties) for integration/environment variables
- `LockService` for write-path synchronization

### External HTTP integrations

- Jigsaw endpoints and token flow
- Finance/lender scoring endpoint(s) as configured by existing implementation

## Script Properties (expected)

Expected script properties include (at minimum for integration paths):

- `JIGSAW_ENV`
- `JIGSAW_USERNAME`
- `JIGSAW_PASSWORD`
- `JIGSAW_SHARED_SECRET`
- Optional path overrides used by integration helpers (open requests/proof/doc endpoints)

> Important: these values are environment-specific and must be set in Apps Script Script Properties, not committed to source.

## Webhook/config secrets

- Webhook signature verification uses shared secret from Script Properties.
- Secrets must never be returned in client responses or printed in plaintext logs.

## Deployment assumptions

Deployment is CI-driven via GitHub Actions on push to `main`.

Required GitHub Secrets:

- `CLASPRC_JSON_B64`
- `CLASP_SCRIPT_ID`
- `GAS_DEPLOYMENT_ID`

Deploy workflow assumptions:

1. `@google/clasp` installed in CI runtime.
2. CI writes `.clasprc.json` and `.clasp.json` from secrets.
3. CI pushes script and redeploys existing deployment.

## Local development assumptions

- No full local runtime for Apps Script web app behavior.
- Local development is file editing + structural validation only.
- Runtime behavior must be validated in deployed/staged Apps Script environment.

## Local setup/bootstrap steps

1. Install dependencies:
   ```bash
   npm ci
   npm run hooks:install
   ```
2. Run repo checks:
   ```bash
   npm run sanity
   npm run lint
   npm test
   ```
3. Configure Apps Script Script Properties in target environment before testing integration flows.
4. Validate critical flows in Apps Script web app context.

## Environment risk notes

- Some environment identifiers are currently hardcoded in source (`SPREADSHEET_ID`, `ROOT_FOLDER_ID`).
- Migration to Script Properties for these values is recommended to reduce hidden environment coupling.
- Any environment key change must be reflected in:
  - this file
  - `README.md` deployment section
  - any onboarding runbook
