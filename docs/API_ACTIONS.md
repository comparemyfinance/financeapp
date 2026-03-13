# API Actions (Runtime Truth)

This file documents the **current runtime action surface**.

## Canonical ownership

- Runtime entrypoints (HTTP + Apps Script bridge): `Code.gs`
  - `doGet`
  - `doPost`
  - `handleWebClientRequest`
- Canonical action routing and handler ownership: `server/router/actions.gs`
  - `routeAction_`
  - `PUBLIC_ACTION_HANDLERS_`
  - `PROTECTED_ACTION_HANDLERS_`

## Canonical transport

- Apps Script UI/internal calls: `google.script.run.handleWebClientRequest({ action, payload })`
- HTTP calls: `POST` body with `{ action, payload }`, parsed by `doPost` and delegated to `routeAction_`

## Response envelope (current)

Success (typical):

```json
{ "success": true, "...": "..." }
```

Error (canonical current shape):

```json
{
  "success": false,
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe message"
  }
}
```

Notes:

- Some handlers return additional compatibility fields (`authRequired`, domain payload fields).
- Client-safe message is expected in `error.message`.
- No stack traces should be returned to client responses.

## Action normalization / aliases

Router alias normalization in `normalizeAction_`:

- `validateJigsawReferral` -> `validateJigsaw`
- `submitJigsawReferral` -> `submitJigsaw`
- `load` -> `getDelta`
- `getAll` -> `getDelta`

## Public actions (no auth gate)

- `healthCheck`
- `authLogin`
- `authStatus`
- `authLogout`
- `runtimeDiagnostics` _(temporary diagnostic action; see `docs/KNOWN_AMBIGUITIES.md`)_

## Protected actions (auth required)

- `listLenders`
- `getLenderQuote`
- `getLenderQuotesBatch`
- `getFinanceNavigatorSoftScore`
- `getPartnerActivitySummary`
- `acquireLock`
- `releaseLock`
- `heartbeatLock`
- `searchFolders`
- `getFolderFiles`
- `getDelta`
- `validateJigsaw`
- `submitJigsaw`
- `save`
- `delete`
- `batchUpdate`

## Config-sensitive actions

- Spreadsheet-dependent: `getDelta`, `getPartnerActivitySummary`, `save`, `delete`, `batchUpdate`
- Drive root-dependent: `searchFolders`

If required config is missing, handlers should preserve specific safe messages such as:

- `Missing required config: SPREADSHEET_ID`
- `Missing required config: ROOT_FOLDER_ID`

## Editing rules

- Add/modify action ownership in: `server/router/actions.gs`
- Update this file whenever action names, aliases, auth gating, or error behavior changes.
