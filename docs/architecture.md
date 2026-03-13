# Architecture Map

## Systems

- **Apps Script Backend (server runtime):**
  - Entry points: `doGet`, `doPost`, `handleWebClientRequest` in `Code.gs`
  - Responsibilities: action routing, auth gating, sheet CRUD, Drive file lookup, external integrations, webhook handling
- **Browser UI (Apps Script HTML templates):**
  - Main shell: `Index.html`
  - Feature tabs: `tab*.html`
  - Communication: `google.script.run.handleWebClientRequest(...)` using `{ action, payload }`
- **Data/infra dependencies:**
  - Google Sheets (deals + supporting sheets)
  - Google Drive (client folders/files)
  - Apps Script `CacheService` (sessions, caches)
  - Script Properties (integration credentials/config)
  - External lender/Jigsaw endpoints

## Boundaries

- `Code.gs`: server concerns only (routing, persistence, integrations)
- `Auth.js`: token/session concerns only
- `Lenderapi.gs`: lender/quote math and lender definitions only
- `Index.html`: shared shell + cross-tab orchestration
- `tab*.html`: feature-local rendering and interaction logic

## Data flow

1. Browser action triggered in UI (`Index.html` or tab template).
2. Client submits `{ action, payload }` via `google.script.run.handleWebClientRequest(...)`.
3. `handleWebClientRequest` delegates to `routeAction_` in `Code.gs`.
4. `routeAction_` enforces auth for protected actions.
5. Handler performs reads/writes to Sheets, Drive, or external APIs.
6. Response envelope returned to client and rendered by UI.

## Naming conventions

- Apps Script helper/function suffix `_` for internal helpers.
- Action names are string-based (`authLogin`, `save`, `getDelta`, `searchFolders`, etc.) and should stay backward compatible.
- Keep canonical template name `Index`/`Index.html` aligned between docs and code.

## Dependency direction

- UI templates depend on backend action contracts.
- Backend router depends on domain helpers (`Auth.js`, `Lenderapi.gs`, `Code.gs` internals).
- Domain logic depends on platform services (Sheets/Drive/Cache/Properties) and external APIs.
- Docs describe behavior and constraints; they should not be behind implementation changes.

## Current constraints

- Runtime is Google Apps Script (V8), so there is no local Node server for feature runtime.
- Large inline scripts still exist in template files; refactors should be incremental.
- Deployment is CI-driven using `clasp`.
