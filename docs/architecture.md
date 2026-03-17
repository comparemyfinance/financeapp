# Architecture Map (Runtime Truth)

## Runtime model

This project runs as a **Google Apps Script Web App** (V8 runtime).

- Entry surface: `Code.gs`
  - `doGet` (UI shell; authenticated GET compatibility only)
  - `doPost` (HTTP POST API)
  - `handleWebClientRequest` (Apps Script bridge for `google.script.run`)
- Router and action ownership: `server/router/actions.gs`
- Shared config helpers: `server/shared/config.gs`
- Shared response/error helpers: `server/shared/response.gs`
- Auth/session backend: `Auth.js`
- Lender domain backend: `Lenderapi.gs`

## Request flow

1. UI triggers action with `{ action, payload }`.
2. Request enters via `handleWebClientRequest` or `doPost` in `Code.gs`.
3. `Code.gs` delegates to `routeAction_` in `server/router/actions.gs`.
4. Router enforces public/protected action gating and dispatches to action handlers.
5. Handlers call domain helpers in `Code.gs` / `Auth.js` / `Lenderapi.gs`.
6. Response returns in canonical envelope shape from shared response helpers.

## UI runtime

- Primary shell: `Index.html` (served by `createTemplateFromFile('Index')`)
- Feature templates: `tab*.html`
- Current reality: both `Index.html` and `tabSalesPipeline.html` still contain substantial API/session logic; canonical/delegated guidance is in `docs/CANONICAL_FILES.md` and `docs/KNOWN_AMBIGUITIES.md`.

## Platform dependencies

- Google Sheets
- Google Drive (Advanced Drive API v3 + `DriveApp`)
- Apps Script services: `PropertiesService`, `CacheService`, `LockService`

## Constraints

- Global Apps Script function namespace (no module imports at runtime).
- Large legacy files remain (`Code.gs`, `Index.html`, `tabSalesPipeline.html`), so changes should be incremental and narrowly scoped.
- Deployment is CI-driven (`clasp` workflows).
