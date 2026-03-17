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
- Read-only GET export path: `GET doGet?api=1&token=...`
  - Requires a valid auth token in the query string.
  - Returns the raw deals array on success.
  - Returns the canonical error envelope on auth/config failure.

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
- `getVrnData`
- `lookupOneAutoFinance`
- `validateJigsaw`
- `submitJigsaw`
- `validateLenderApplication`
- `submitLenderApplication`
- `save`
- `delete`
- `batchUpdate`

## Config-sensitive actions

- Spreadsheet-dependent: `getDelta`, `getPartnerActivitySummary`, `save`, `delete`, `batchUpdate`, `getVrnData`
- Drive root-dependent: `searchFolders`
- OneAuto credential-dependent: `lookupOneAutoFinance`

If required config is missing, handlers should preserve specific safe messages such as:

- `Missing required config: SPREADSHEET_ID`
- `Missing required config: ROOT_FOLDER_ID`

## Editing rules

- Add/modify action ownership in: `server/router/actions.gs`
- Update this file whenever action names, aliases, auth gating, or error behavior changes.

## Lender validation (additive, current)

- `validateLenderApplication`
  - Auth: protected.
  - Request payload (current minimum):
    - `selectedLender` (required)
    - `deal` (required placeholder payload source)
  - Response includes:
    - `selectedLender`
    - `validationProvider`
    - `submissionProvider`
    - `statusMessage`
    - `result`

- `submitLenderApplication`
  - Auth: protected.
  - Request payload (current minimum):
    - `selectedLender` (required)
    - `deal` (required placeholder payload source)
  - Behavior:
    - re-runs validation through provider dispatch before attempting submission provider.
    - non-Jigsaw lenders use simulated success provider after validation passes.
    - Jigsaw remains the only live-capable submission provider mapping; submit remains backend-contract only until UI activation.
  - Response includes:
    - `selectedLender`
    - `validationProvider`
    - `submissionProvider`
    - `statusMessage`
    - `validation`
    - `result`

Compatibility notes:

- These actions are additive and do not replace `validateJigsaw` / `submitJigsaw`.
- Current placeholder behavior uses `JigsawRules` validation provider for all lenders.
- Only `Jigsaw` maps to live submission provider (`JigsawLive`); non-Jigsaw lenders map to `SimulatedSuccess`.
